#!/usr/bin/env node
/*
 * worklog-update.js — local-source updater for the Work Journal.
 *
 *   node worklog-update.js              check, then apply if the source folder differs from installed
 *   node worklog-update.js --check      report only (dry run) — never applies
 *   node worklog-update.js --source DIR override where the updated setup folder lives
 *
 * Model (v1 = local): the "latest" comes from the bundled setup skill the user already refreshed
 * (new zip / catalog pull) at  <claude>/skills/work-journal-setup/. We compare a CONTENT manifest
 * (sha256 over the source `src/` tree + VERSION) against the manifest stamped at install time — so a
 * same-version hotfix or a hand-patch is detected too, not only a version bump. If it differs we print
 * what changed (from upgrade-notes.json) + any items needing the user's attention, then re-run the
 * idempotent install.js.
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
function flagVal(name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }

// Locate the refreshed setup folder (must hold both install.js and src/).
function findSource() {
  const cands = [flagVal('--source'), path.join(CLAUDE_DIR, 'skills', 'work-journal-setup')].filter(Boolean);
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'install.js')) && fs.existsSync(path.join(c, 'src'))) return c;
  }
  return null;
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

function main() {
  console.log('— Work Journal · עדכון —\n');

  const src = findSource();
  if (!src) {
    console.log('✗ לא נמצאה תיקיית מקור לעדכון.');
    console.log('  הנח את תיקיית ההתקנה המעודכנת ב:');
    console.log('    ' + fwd(path.join(CLAUDE_DIR, 'skills', 'work-journal-setup')));
    console.log('  (חלץ zip חדש או עדכן את ה-clone של הקטלוג), ואז הרץ שוב.');
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
    console.log('✓ עדכני — אין מה לעדכן.');
    console.log('  (לגרסה חדשה: רענן את תיקיית work-journal-setup ואז הרץ שוב.)');
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
