#!/usr/bin/env node
/*
 * worklog-update.js — self-updating updater for the Work Journal.
 *
 *   node worklog-update.js              pull latest from GitHub, then apply if it differs from installed
 *   node worklog-update.js --check      report only (dry run) — never applies
 *   node worklog-update.js --notify     silent daily check: toast if an update exists (auto-apply if update.auto)
 *   node worklog-update.js --no-remote  skip the GitHub pull; use the local setup folder only
 *   node worklog-update.js --source DIR override where the updated setup folder lives (implies --no-remote)
 *
 * Model (v2 = remote, v0.9.0): the "latest" is pulled straight from the distribution repo (the catalog)
 * by worklog-remote.js into a local cache clone — NO manual "re-download the zip / pull the repo" step.
 * We then compare a CONTENT manifest (sha256 over the source `src/` tree + VERSION) against the manifest
 * stamped at install time — so a same-version hotfix or hand-patch is caught too, not only a version
 * bump. If it differs we print what changed (from upgrade-notes.json) + any attention items, then re-run
 * the idempotent install.js. If GitHub can't be reached (no creds/offline), we degrade gracefully:
 * the interactive run falls back to a local folder if present; the daily --notify check stays silent.
 *
 * Credentials are NEVER touched: .email-cred / .calendar-cred (DPAPI-encrypted) live in the journal
 * dir, outside the source tree and outside install.js's scope. A normal update asks for nothing.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const lib = require('./worklog-lib.js');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const JOURNAL = lib.ROOT;
const fwd = (p) => String(p).replace(/\\/g, '/');

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const NOTIFY = argv.includes('--notify');
function flagVal(name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }

// Locate the setup folder to update from (must hold both install.js and src/). The freshly-pulled
// GitHub cache (when available) is preferred; then an explicit --source; then the local setup folder.
function findSource(remoteBundle) {
  const cands = [remoteBundle, flagVal('--source'), path.join(CLAUDE_DIR, 'skills', 'work-journal-setup')].filter(Boolean);
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'install.js')) && fs.existsSync(path.join(c, 'src'))) return c;
  }
  return null;
}

// Pull the latest bundle from GitHub into the local cache, unless explicitly disabled. Fail-safe:
// returns the bundle path on success, or null (caller falls back to a local folder / stays silent).
function pullRemote() {
  if (argv.includes('--no-remote') || flagVal('--source')) return { bundle: null, info: null };
  try {
    const remote = require('./worklog-remote.js');
    const info = remote.refreshCache();
    return { bundle: info.ok ? info.bundlePath : null, info };
  } catch (e) {
    return { bundle: null, info: { ok: false, reason: 'remote-error', detail: e.message } };
  }
}

const readTrim = (f) => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return null; } };
const installedVersion = () => readTrim(path.join(JOURNAL, '.installed-version'));
const installedManifest = () => readTrim(path.join(JOURNAL, '.installed-manifest'));
const sourceVersion = (root) => readTrim(path.join(root, 'VERSION'));

// Numeric dotted comparison: a>b -> 1, a<b -> -1, equal -> 0 (pre-release tags ignored).
function cmpVer(a, b) {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function loadNotes(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'upgrade-notes.json'), 'utf8')); } catch { return {}; }
}
// Notes for versions in (fromV, toV], ascending. With no installed version, include everything <= toV.
function notesBetween(notes, fromV, toV) {
  return Object.keys(notes)
    .filter((v) => (fromV ? cmpVer(v, fromV) > 0 : true) && cmpVer(v, toV) <= 0)
    .sort(cmpVer)
    .map((v) => ({ version: v, summary: notes[v] && notes[v].summary, action: notes[v] && notes[v].action }));
}

function printChanges(entries) {
  if (!entries.length) { console.log('  (אין הערות-גרסה מפורטות)'); return; }
  console.log('מה השתנה:');
  for (const e of entries) console.log('  • ' + e.version + ' — ' + (e.summary || '(ללא תיאור)'));
}

// Returns the action items (required first), or [] if none.
function actionItems(entries) {
  return entries
    .filter((e) => e.action)
    .map((e) => ({ version: e.version, required: !!e.action.required, text: e.action.text || '' }))
    .sort((a, b) => (a.required === b.required ? 0 : a.required ? -1 : 1));
}

function printActions(items) {
  if (!items.length) { console.log('\n✓ אין פעולות שדורשות התייחסות — העדכון אוטומטי לחלוטין.'); return; }
  console.log('\n⚠️  דורש תשומת-לב:');
  for (const it of items) {
    console.log('  • [' + it.version + '] ' + (it.required ? 'חובה' : 'אופציונלי') + ': ' + it.text);
  }
}

function applyInstall(srcRoot) {
  const installer = path.join(srcRoot, 'install.js');
  console.log('\n→ מחיל עדכון (' + fwd(installer) + ') ...\n');
  const r = spawnSync(process.execPath, [installer], { stdio: 'inherit' });
  return r.status === 0;
}

// Silent daily check (spawned by the 18:00 task via --notify): pull from GitHub, and if a newer bundle
// exists either toast "update available" or — when update.auto is on — apply it and toast "updated".
// Stays completely quiet when up to date or when GitHub can't be reached (never nags).
function notifyCheck() {
  const { bundle, info } = pullRemote();
  if (!bundle) return; // offline / no creds / no git → silent; the interactive run will surface it
  const instM = installedManifest();
  const availM = lib.computeManifest(bundle);
  if (instM && instM === availM) return; // already up to date
  const instV = installedVersion();
  const availV = sourceVersion(bundle);
  if (instV && availV && cmpVer(availV, instV) < 0) return; // remote somehow older → ignore
  let notifier; try { notifier = require('./worklog-notify.js'); } catch { return; }
  const auto = !!(info && require('./worklog-remote.js').gitConfig().auto);
  if (auto) {
    if (applyInstall(bundle)) {
      notifier.notify('📦 Work Journal עודכן ל-' + (availV || '?'), 'העדכון הוחל אוטומטית — ייכנס לתוקף מהסשן הבא.', JOURNAL);
    }
  } else {
    const v = instV && availV ? ' (' + instV + ' → ' + availV + ')' : '';
    notifier.notify('📦 עדכון זמין ל-Work Journal' + v, 'הרץ /worklog update כדי לעדכן.', JOURNAL);
  }
}

function main() {
  if (NOTIFY) { notifyCheck(); return; }

  console.log('— Work Journal · עדכון —\n');

  const { bundle: remoteBundle, info: remoteInfo } = pullRemote();
  if (remoteBundle) {
    console.log('  נמשך מ-GitHub ✓' + (remoteInfo && remoteInfo.head ? ' (' + remoteInfo.head + ')' : ''));
  } else if (remoteInfo && !remoteInfo.ok && !argv.includes('--no-remote') && !flagVal('--source')) {
    console.log('  ⚠️  לא הצלחתי למשוך מ-GitHub (' + remoteInfo.reason + ') — מנסה תיקייה מקומית.');
  }

  const src = findSource(remoteBundle);
  if (!src) {
    console.log('✗ לא נמצא מקור לעדכון (לא מ-GitHub ולא מקומי).');
    if (remoteInfo && remoteInfo.detail) console.log('  פרט: ' + remoteInfo.detail);
    console.log('  ודא שיש לך גישת git לקטלוג, או הנח תיקיית setup מעודכנת ב:');
    console.log('    ' + fwd(path.join(CLAUDE_DIR, 'skills', 'work-journal-setup')));
    process.exit(2);
  }

  const instV = installedVersion();
  const instM = installedManifest();
  const availV = sourceVersion(src);
  const availM = lib.computeManifest(src);

  console.log('  מותקן:  ' + (instV || '?') + (instM ? '' : '  (ללא manifest — התקנה מלפני 0.8.0)'));
  console.log('  מקור:   ' + (availV || '?') + '   (' + fwd(src) + ')\n');

  // Up to date: identical content (only trustworthy when we have a baseline manifest).
  if (instM && instM === availM) {
    console.log('✓ עדכני — אין מה לעדכן' + (remoteBundle ? ' (כבר על הגרסה האחרונה מ-GitHub).' : '.'));
    return;
  }

  // Source older than installed → almost certainly a stale folder; refuse to silently downgrade.
  if (instV && availV && cmpVer(availV, instV) < 0) {
    console.log('⚠️  גרסת המקור (' + availV + ') ישנה מהמותקנת (' + instV + ').');
    console.log('  נראה שתיקיית המקור לא מעודכנת — רענן אותה לגרסה החדשה ואז הרץ שוב. (לא מחיל downgrade אוטומטית.)');
    process.exit(3);
  }

  // There is something to apply.
  const entries = notesBetween(loadNotes(src), instV, availV);
  if (instV && availV && cmpVer(availV, instV) === 0) {
    console.log('● נמצא עדכון תוכן באותה גרסה (' + availV + ') — patch/תיקון.');
  } else {
    console.log('● נמצא עדכון: ' + (instV || '?') + ' → ' + (availV || '?'));
  }
  printChanges(entries);
  const items = actionItems(entries);

  if (CHECK_ONLY) {
    printActions(items);
    console.log('\n(--check: בדיקה בלבד, לא הוחל דבר. הרץ ללא --check כדי לעדכן.)');
    return;
  }

  const ok = applyInstall(src);
  if (!ok) {
    console.log('\n✗ ההתקנה נכשלה — שום דבר לא נחתם מחדש. בדוק את הפלט למעלה.');
    process.exit(1);
  }
  console.log('✓ עודכן ל-' + (availV || '?') + '. ייכנס לתוקף מהסשן הבא של Claude Code.');
  printActions(items);
}

try { main(); }
catch (e) { console.error('update failed: ' + (e && e.message ? e.message : e)); process.exit(1); }
