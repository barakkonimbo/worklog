#!/usr/bin/env node
// worklog-session-end.js — SessionEnd hook (hybrid safety net).
// If this session never logged anything to today's journal, write a single
// fallback entry derived from the session's first real user request, so no
// working session leaves a gap. Then clean up the session marker.
//
// Non-blocking; output is ignored by the harness. Wired under hooks.SessionEnd.

const fs = require('fs');
const path = require('path');
const lib = require('./worklog-lib.js');

// Recursion guard: skip during a summary generator run (claude -p, WORKLOG_DISABLE=1).
if (process.env.WORKLOG_DISABLE === '1') process.exit(0);

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }

let data = {};
try { data = JSON.parse(readStdin() || '{}'); } catch { data = {}; }

const sid = data.session_id || '';
const reason = data.reason || 'other';
const d = lib.now();

// Load this session's marker (written at SessionStart).
let marker = null;
const markerPath = sid ? path.join(lib.SESSIONS, sanitize(sid) + '.json') : null;
if (markerPath) {
  try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch { marker = null; }
}

// Did this session already log something? Scan today's file for an entry whose
// HH:MM is >= the session start time (same calendar day).
function loggedThisSession(m) {
  if (!m || !m.startTime) return true;            // unknown start -> don't force a fallback
  if (m.startDate !== lib.dateKey(d)) return true; // session spanned days -> skip fallback
  const content = lib.readIf(lib.dailyFile(d));
  if (!content) return false;
  const re = lib.entryRe('gm');
  let mm, max = null;
  while ((mm = re.exec(content))) { if (max === null || mm[1] > max) max = mm[1]; }
  if (max === null) return false;
  return max >= m.startTime;
}

// Pull the first genuine human prompt + count of genuine prompts from the transcript.
function analyzeTranscript(tp) {
  const res = { first: null, count: 0 };
  if (!tp) return res;
  let raw;
  try { raw = fs.readFileSync(tp, 'utf8'); } catch { return res; }
  for (const ln of raw.split('\n')) {
    if (!ln.trim()) continue;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    if (o.type !== 'user' || o.isMeta) continue;
    const c = o.message && o.message.content;
    if (!Array.isArray(c)) continue;                 // tool_result msgs are arrays too -> filtered below
    const texts = c.filter((x) => x && x.type === 'text' && typeof x.text === 'string').map((x) => x.text);
    if (!texts.length) continue;                     // e.g. pure tool_result message
    const txt = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (!txt || txt.startsWith('<')) continue;       // skip system-reminder / command wrappers
    res.count++;
    if (!res.first) res.first = txt;
  }
  return res;
}

// --- Calendar mirror (optional): keep the day's blocks current on every session close ---
// Unlike the once-a-day email (a one-shot push), the calendar is a continuously-updated mirror,
// so work added after the 20:30 run — or any time of day — still lands in it. Self-gated + fire-and-forget.
function calendarEnabled() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(lib.ROOT, 'config.json'), 'utf8'));
    return !!(c.calendar && c.calendar.enabled && c.calendar.calendarId);
  } catch { return false; }
}
function spawnCalendarSync(dateStr) {
  try {
    const script = path.join(__dirname, 'worklog-calendar.js');
    if (!fs.existsSync(script)) return;
    const { spawn } = require('child_process');
    // detached + unref: a slow or failed network sync must NEVER delay or break session close
    spawn(process.execPath, [script, '--sync', dateStr], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* non-fatal */ }
}

try {
  // Capture the real session interval for Calendar blocks (cheap, no AI).
  // Records {start,end,project,sessionId}; dedup-by-sessionId happens at read time
  // (worklog-blocks.js). E6: a session that crossed midnight is split at the day boundary.
  if (marker && marker.startTime && marker.project) {
    const endDate = lib.dateKey(d);
    const endTime = lib.timeKey(d);
    const sessionId = sid || undefined;
    const writeSession = (dateKey, start, end) => {
      const f = path.join(lib.SESSIONS, dateKey + '.jsonl');
      fs.mkdirSync(lib.SESSIONS, { recursive: true });
      fs.appendFileSync(f, JSON.stringify({ start, end, project: marker.project, sessionId }) + '\n', 'utf8');
    };
    if (marker.startDate && marker.startDate !== endDate) {
      writeSession(marker.startDate, marker.startTime, '23:59'); // tail of the start day
      writeSession(endDate, '00:00', endTime);                   // head of the end day
    } else {
      writeSession(endDate, marker.startTime, endTime);
    }
  }
} catch { /* non-fatal */ }

try {
  if (marker && !loggedThisSession(marker)) {
    const { first, count } = analyzeTranscript(data.transcript_path);
    // Only bother for substantive sessions (>= 2 real prompts) with a captured topic.
    if (count >= 2 && first) {
      const snippet = first.length > 90 ? first.slice(0, 90) + '…' : first;
      lib.appendEntry({
        project: marker.project || lib.projectFromCwd(marker.cwd || process.cwd()),
        message: '(אוטו) ' + snippet,
        time: marker.startTime,
      });
    }
  }
} catch { /* non-fatal */ }

// Refresh the Calendar mirror for the day(s) this session touched — only if calendar is enabled
// and the session contributed work. Runs AFTER the fallback so an auto-entry is included too.
try {
  if (marker && marker.startTime && marker.project && calendarEnabled()) {
    const endDate = lib.dateKey(d);
    const days = (marker.startDate && marker.startDate !== endDate) ? [marker.startDate, endDate] : [endDate];
    for (const day of days) spawnCalendarSync(day);
  }
} catch { /* non-fatal — calendar must never break session close */ }

// cleanup marker
if (markerPath) { try { fs.unlinkSync(markerPath); } catch { /* ignore */ } }

process.exit(0);
