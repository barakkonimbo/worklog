#!/usr/bin/env node
/*
 * install.js — portable, idempotent installer for the Work Journal system.
 *
 * Run from a terminal:   node install/install.js
 * Re-running is safe (idempotent): it replaces our pieces, never duplicates,
 * and backs up settings.json before touching it.
 *
 * What it does:
 *   1. copies src/hooks/*.js            -> <claude>/hooks/
 *   2. installs the /worklog skill      -> <claude>/skills/worklog/SKILL.md   (paths substituted)
 *   3. merges the work-journal block    -> <claude>/CLAUDE.md                 (between markers)
 *   4. merges UserPromptSubmit+SessionStart+SessionEnd -> <claude>/settings.json (idempotent, backed up)
 *   4b. backfills new default keys into an existing config.json (upgrade; preserves user values)
 *   5. registers scheduled summaries    -> Windows Task Scheduler (per config: 18:00 notify / 20:30 email+calendar / Sun weekly)
 *   6. ensures the journal data dir + stamps .installed-version & .installed-manifest (for /worklog update)
 *
 * Paths are resolved locally (os.homedir, process.execPath) so it works on any machine.
 * Honors CLAUDE_CONFIG_DIR if set.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const fwd = (p) => String(p).replace(/\\/g, '/');
const log = (s) => console.log('  ' + s);

// ---------- locate the source tree (dev: ../src ; bundled: ./src) ----------
function findSrc() {
  const cands = [path.join(__dirname, '..', 'src'), path.join(__dirname, 'src')];
  for (const c of cands) if (fs.existsSync(path.join(c, 'hooks', 'worklog-lib.js'))) return c;
  throw new Error('Source tree not found. Looked in:\n  ' + cands.join('\n  '));
}

function findVersion() {
  for (const c of [path.join(__dirname, '..', 'VERSION'), path.join(__dirname, 'VERSION')]) {
    try { return fs.readFileSync(c, 'utf8').trim(); } catch { /* try next */ }
  }
  return 'unknown';
}

// ---------- resolve target environment ----------
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const JOURNAL_DIR = path.join(CLAUDE_DIR, 'work-journal');
const NODE = process.execPath;

function subst(text) {
  return text
    .replace(/\{\{NODE\}\}/g, fwd(NODE))
    .replace(/\{\{HOOKS_DIR\}\}/g, fwd(HOOKS_DIR))
    .replace(/\{\{JOURNAL_DIR\}\}/g, fwd(JOURNAL_DIR));
}

function main() {
  const SRC = findSrc();
  const VERSION = findVersion();
  let prev = '';
  try { prev = fs.readFileSync(path.join(JOURNAL_DIR, '.installed-version'), 'utf8').trim(); } catch { /* fresh */ }
  console.log('Work Journal — installer');
  log('version:    ' + VERSION + (prev ? (prev === VERSION ? '  (reinstall)' : '  (updating from ' + prev + ')') : '  (fresh install)'));
  log('source:     ' + fwd(SRC));
  log('config dir: ' + fwd(CLAUDE_DIR));
  log('node:       ' + fwd(NODE));
  console.log('');

  // 1. hooks
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  const hookFiles = fs.readdirSync(path.join(SRC, 'hooks')).filter((f) => f.endsWith('.js'));
  for (const f of hookFiles) fs.copyFileSync(path.join(SRC, 'hooks', f), path.join(HOOKS_DIR, f));
  log('hooks: copied ' + hookFiles.length + ' files -> ' + fwd(HOOKS_DIR));

  // 2. skill (substitute paths)
  const skillDir = path.join(SKILLS_DIR, 'worklog');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    subst(fs.readFileSync(path.join(SRC, 'skill', 'SKILL.tpl.md'), 'utf8')),
    'utf8'
  );
  log('skill: installed /worklog -> ' + fwd(skillDir));

  // 3. CLAUDE.md block (replace between markers, else append)
  const claudeMdPath = path.join(CLAUDE_DIR, 'CLAUDE.md');
  const snippet = subst(fs.readFileSync(path.join(SRC, 'templates', 'claude-md-snippet.md'), 'utf8')).trim();
  let claudeMd = '';
  try { claudeMd = fs.readFileSync(claudeMdPath, 'utf8'); } catch { /* new file */ }
  const blockRe = /<!-- WORK-JOURNAL:START[\s\S]*?WORK-JOURNAL:END -->/;
  if (blockRe.test(claudeMd)) claudeMd = claudeMd.replace(blockRe, snippet);
  else claudeMd = (claudeMd.trim() ? claudeMd.trim() + '\n\n' : '') + snippet + '\n';
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(claudeMdPath, claudeMd, 'utf8');
  log('CLAUDE.md: merged work-journal block');

  // 4. settings.json hooks (idempotent, with backup)
  const settingsPath = path.join(CLAUDE_DIR, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    try { settings = JSON.parse(raw); }
    catch (e) {
      console.error('  ABORT: ' + fwd(settingsPath) + ' is not valid JSON — leaving it untouched.\n         ' + e.message);
      process.exit(1);
    }
    fs.writeFileSync(settingsPath + '.bak', raw, 'utf8');
    log('settings.json: backed up -> settings.json.bak');
  }
  settings.hooks = settings.hooks || {};
  const hookTpl = JSON.parse(subst(fs.readFileSync(path.join(SRC, 'templates', 'settings-hooks.json'), 'utf8')));
  mergeHookEvent(settings, hookTpl, 'UserPromptSubmit', 'worklog-prompt.js');
  mergeHookEvent(settings, hookTpl, 'SessionStart', 'worklog-session-start.js');
  mergeHookEvent(settings, hookTpl, 'SessionEnd', 'worklog-session-end.js');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  log('settings.json: merged UserPromptSubmit + SessionStart + SessionEnd (existing hooks preserved)');

  // 4b. backfill new config defaults into an existing config.json (upgrade path).
  //     Merge defaults UNDER the user's values so new keys (e.g. calendar.activityGapMinutes/
  //     tailMinutes) become present + tunable, while every existing value is preserved.
  ensureConfigDefaults();

  // 5. scheduling
  if (process.platform === 'win32') registerWindowsTasks();
  else log('scheduling: ' + process.platform + ' not yet supported — add cron/launchd manually (see docs/DECISIONS.md D4).');

  // 6. journal data dir + version stamp + content manifest (for `/worklog update` change-detection)
  fs.mkdirSync(path.join(JOURNAL_DIR, '.sessions'), { recursive: true });
  fs.writeFileSync(path.join(JOURNAL_DIR, '.installed-version'), VERSION + '\n', 'utf8');
  try {
    const lib = require(path.join(SRC, 'hooks', 'worklog-lib.js'));
    fs.writeFileSync(path.join(JOURNAL_DIR, '.installed-manifest'), lib.computeManifest(path.dirname(SRC)) + '\n', 'utf8');
  } catch { /* non-fatal: update falls back to version comparison */ }
  log('journal: ensured ' + fwd(JOURNAL_DIR) + '  (version ' + VERSION + ')');

  console.log('\nDone ✅  Hooks activate on your NEXT Claude Code session.');
  console.log('Manual control: /worklog   •   summaries land in ' + fwd(JOURNAL_DIR));
}

// Backfill new default keys into an EXISTING config.json on upgrade, without clobbering anything the
// user set. Defaults go UNDER the user's values (user wins on every conflict); only genuinely-missing
// keys are added. No config.json yet (calendar/email never set up) → nothing to do: defaultConfig is
// applied at --setup time, and computeBlocks/calendar fall back to the same defaults at read time, so
// behavior is identical either way. Backs up before rewriting; only writes when something changed.
function ensureConfigDefaults() {
  const cfgPath = path.join(JOURNAL_DIR, 'config.json');
  let ex;
  try { ex = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { return; } // absent/invalid → skip
  const schedule = require(path.join(findSrc(), 'hooks', 'worklog-schedule.js'));
  const d = schedule.defaultConfig();
  const merged = {
    ...d, ...ex,
    email: { ...d.email, ...(ex.email || {}) },
    weekly: { ...d.weekly, ...(ex.weekly || {}) },
    calendar: { ...d.calendar, ...(ex.calendar || {}) },
    update: { ...d.update, ...(ex.update || {}) },
  };
  if (JSON.stringify(merged) === JSON.stringify(ex)) { log('config.json: already current (no new keys)'); return; }
  try { fs.writeFileSync(cfgPath + '.bak', JSON.stringify(ex, null, 2) + '\n', 'utf8'); } catch { /* non-fatal */ }
  fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  log('config.json: backfilled new default keys (existing values preserved; backup → config.json.bak)');
}

// Remove any existing groups whose command references scriptName, then append the template's group(s).
function mergeHookEvent(settings, hookTpl, eventName, scriptName) {
  const existing = settings.hooks[eventName] || [];
  const filtered = existing.filter((group) => {
    const hs = (group && group.hooks) || [];
    return !hs.some((h) => h && typeof h.command === 'string' && h.command.includes(scriptName));
  });
  for (const g of hookTpl[eventName] || []) filtered.push(g);
  settings.hooks[eventName] = filtered;
}

function registerWindowsTasks() {
  // Delegate to the shared, config-driven scheduler so install and /worklog settings agree.
  const schedule = require(path.join(findSrc(), 'hooks', 'worklog-schedule.js'));
  let cfg = schedule.defaultConfig();
  try {
    const ex = JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, 'config.json'), 'utf8'));
    // preserve ALL saved settings (email, weekly, calendar, language) so re-running the
    // installer never silently drops a task — e.g. a calendar-only user (no email) still
    // gets the 20:30 task, which registerTasks adds when email OR calendar is enabled.
    cfg = {
      language: ex.language || cfg.language,
      email: { ...cfg.email, ...(ex.email || {}) },
      weekly: { ...cfg.weekly, ...(ex.weekly || {}) },
      calendar: { ...cfg.calendar, ...(ex.calendar || {}) },
    };
  } catch { /* no existing config -> defaults (email off until --setup) */ }
  const res = schedule.registerTasks({ node: NODE, summaryScript: path.join(HOOKS_DIR, 'worklog-summary.js'), config: cfg });
  if (res.ok) log('scheduling: interim 18:00 (Sun-Thu) + email/weekly per config');
  else console.error('  scheduling warning: ' + (res.stderr || res.reason || ''));
}

try { main(); }
catch (e) { console.error('Install failed: ' + e.message); process.exit(1); }
