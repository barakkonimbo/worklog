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
  const re = /^- (\d{2}:\d{2}) \[/gm;
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

// cleanup marker
if (markerPath) { try { fs.unlinkSync(markerPath); } catch { /* ignore */ } }

process.exit(0);
