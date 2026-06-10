#!/usr/bin/env node
// worklog-backfill.js — self-heal safety net (v0.8.3).
//
// The scheduled end-of-day run can be missed or KILLED mid-generation (laptop asleep, on battery,
// or shut down — Windows aborts the task with 0x8007042B). When that happens the day's summary file
// is never written, so nothing is emailed or synced to the calendar either: a silent gap.
//
// This script — spawned detached + fail-safe by the SessionStart hook (so it can never block or break
// session start) — scans the last few days and, for any day that HAS entries but has NO summary file,
// regenerates the summary and delivers it to every enabled target, exactly as the scheduled run would.
// Because a real session means the machine is definitely on, this catches anything the scheduler missed.
//
// Run modes (also usable by hand / tests):
//   node worklog-backfill.js              scan + backfill any missed day in the window
//   node worklog-backfill.js --list       print the missed days, do nothing (dry run)
//   node worklog-backfill.js --days N      override the lookback window (default 3)
//
// Dedup: it runs `worklog-summary.js --daily --date <day> --email` per missed day — the same call the
// scheduler uses — so summary write + email + calendar sync + the monotonic `.email-last-sent`
// high-water mark are all shared with the scheduled catch-up. A day is only ever delivered once
// (after backfill the summary file exists, so it's no longer detected).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./worklog-lib.js');

// Recursion guard: the summary generator spawns `claude -p` with WORKLOG_DISABLE=1; never backfill
// from inside a headless summary run (the SessionStart hook that launches us already early-exits on
// this env, so in practice we run with a clean env — this is belt-and-suspenders).
if (process.env.WORKLOG_DISABLE === '1') process.exit(0);

const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes('--list');
const di = argv.indexOf('--days');
const LOOKBACK = di >= 0 && Number(argv[di + 1]) > 0 ? Number(argv[di + 1]) : 3;

// Concurrency / hammer guard: if a backfill ran very recently, don't start another (two sessions
// opening at once, or a slow run still in flight). Short cooldown — a genuine retry next day is fine.
const LOCK = path.join(lib.ROOT, '.backfill.lock');
const COOLDOWN_MS = 5 * 60 * 1000;
function recentlyRan() {
  try { return Date.now() - fs.statSync(LOCK).mtimeMs < COOLDOWN_MS; } catch { return false; }
}
function touchLock() {
  try { fs.writeFileSync(LOCK, lib.dateKey(lib.now()) + ' ' + lib.timeKey(lib.now()) + '\n', 'utf8'); }
  catch { /* non-fatal */ }
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Pure + testable: the days in [today-lookback, today-1] that HAVE entries but have NO summary file.
// Returned oldest → newest. Today is excluded — it's still in progress and owned by the scheduled run.
function findMissedDays(baseDate, lookback) {
  const out = [];
  for (let i = lookback; i >= 1; i--) {
    const d = addDays(baseDate, -i);
    const hasEntries = lib.hasEntryLine(lib.readIf(lib.dailyFile(d)));
    const hasSummary = fs.existsSync(lib.summaryFile(d));
    if (hasEntries && !hasSummary) out.push(lib.dateKey(d));
  }
  return out;
}

function main() {
  lib.ensureDirs();
  const missed = findMissedDays(lib.now(), LOOKBACK);

  if (LIST_ONLY) {
    console.log(missed.length ? missed.join('\n') : '(none)');
    return;
  }
  if (!missed.length) return;            // nothing to heal — the common case, fast and silent
  if (recentlyRan()) return;             // another backfill is in flight / just ran
  touchLock();

  const summaryScript = path.join(__dirname, 'worklog-summary.js');
  if (!fs.existsSync(summaryScript)) return;

  for (const dk of missed) {
    // `--email` ⇒ scheduled semantics: writes the summary, delivers to every ENABLED target, and
    // advances the monotonic last-sent marker (so the scheduler won't re-send the same day).
    try {
      const r = spawnSync(process.execPath, [summaryScript, '--daily', '--date', dk, '--email'], {
        encoding: 'utf8', windowsHide: true, timeout: 200000, env: { ...process.env },
      });
      if (r.stdout && r.stdout.trim()) console.log('[worklog-backfill] ' + dk + ': ' + r.stdout.trim().split('\n').pop());
      if (r.status !== 0 && r.stderr) console.error('[worklog-backfill] ' + dk + ':', r.stderr.slice(0, 300));
    } catch (e) {
      console.error('[worklog-backfill] ' + dk + ' failed:', e.message);
    }
  }
}

try { main(); } catch (e) { try { console.error('[worklog-backfill]', e.message); } catch { /* ignore */ } }

module.exports = { findMissedDays };
