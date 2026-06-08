#!/usr/bin/env node
/*
 * uninstall.js — cleanly remove the Work Journal system.
 *
 *   node install/uninstall.js            remove the system, KEEP the journal data
 *   node install/uninstall.js --purge    also delete <claude>/work-journal (the logs)
 *
 * Idempotent. Backs up settings.json before editing.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const fwd = (p) => String(p).replace(/\\/g, '/');
const log = (s) => console.log('  ' + s);
const purge = process.argv.includes('--purge');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const JOURNAL_DIR = path.join(CLAUDE_DIR, 'work-journal');

function rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; } }

console.log('Work Journal — uninstaller');
log('config dir: ' + fwd(CLAUDE_DIR));
console.log('');

// 1. hooks — remove EVERY worklog*.js (mirrors install.js, which copies the whole hooks dir).
// A hard-coded list silently goes stale as hooks are added (notify/email/config/schedule/blocks/
// calendar/update + the worklog.js dispatcher), leaving orphaned files behind — so match by prefix.
let n = 0;
try {
  for (const f of fs.readdirSync(HOOKS_DIR)) {
    if (/^worklog(-.*)?\.js$/.test(f) && rm(path.join(HOOKS_DIR, f))) n++;
  }
} catch { /* hooks dir absent — nothing to remove */ }
log('hooks: removed ' + n + ' files');

// 2. skill
rm(path.join(SKILLS_DIR, 'worklog'));
log('skill: removed /worklog');

// 3. CLAUDE.md block
const claudeMdPath = path.join(CLAUDE_DIR, 'CLAUDE.md');
try {
  let md = fs.readFileSync(claudeMdPath, 'utf8');
  const before = md;
  md = md.replace(/\n*<!-- WORK-JOURNAL:START[\s\S]*?WORK-JOURNAL:END -->\n*/, '\n');
  if (md !== before) { fs.writeFileSync(claudeMdPath, md.trim() ? md : '', 'utf8'); log('CLAUDE.md: removed work-journal block'); }
  else log('CLAUDE.md: no block found');
} catch { log('CLAUDE.md: not present'); }

// 4. settings.json hooks
const settingsPath = path.join(CLAUDE_DIR, 'settings.json');
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, 'utf8');
  let settings;
  try { settings = JSON.parse(raw); }
  catch (e) { console.error('  settings.json invalid JSON — skipping. ' + e.message); settings = null; }
  if (settings && settings.hooks) {
    fs.writeFileSync(settingsPath + '.bak', raw, 'utf8');
    for (const [evt, script] of [['UserPromptSubmit', 'worklog-prompt.js'], ['SessionStart', 'worklog-session-start.js'], ['SessionEnd', 'worklog-session-end.js']]) {
      if (!Array.isArray(settings.hooks[evt])) continue;
      settings.hooks[evt] = settings.hooks[evt].filter((g) => {
        const hs = (g && g.hooks) || [];
        return !hs.some((h) => h && typeof h.command === 'string' && h.command.includes(script));
      });
      if (settings.hooks[evt].length === 0) delete settings.hooks[evt];
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    log('settings.json: removed worklog hooks (backup -> settings.json.bak)');
  }
}

// 5. scheduled tasks (Windows)
if (process.platform === 'win32') {
  // Remove every task the system may have registered, including the fixed 18:00 WorkJournal-Notify
  // and the legacy WorkJournal-Daily (renamed in v0.6) — otherwise a stale task lingers after uninstall.
  const ps = "Unregister-ScheduledTask -TaskName 'WorkJournal-Daily','WorkJournal-Notify','WorkJournal-DailyEmail','WorkJournal-Weekly' -Confirm:$false -ErrorAction SilentlyContinue; Write-Output 'ok'";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  log('scheduling: removed WorkJournal-Notify / DailyEmail / Weekly' + (r.status === 0 ? '' : ' (may not have existed)'));
}

// 6. journal data
if (purge) { rm(JOURNAL_DIR); log('journal data: PURGED ' + fwd(JOURNAL_DIR)); }
else log('journal data: kept at ' + fwd(JOURNAL_DIR) + ' (use --purge to delete)');

console.log('\nDone. Removal takes full effect on your next Claude Code session.');
