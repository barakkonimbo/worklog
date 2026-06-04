#!/usr/bin/env node
/*
 * worklog-blocks.js — PURE, deterministic time-block computation (no AI, no I/O).
 * Turns real session intervals + log entries into calendar-ready blocks, using the
 * "session-anchored, gap-trimmed" model (see docs/CALENDAR-SPEC.md).
 *
 * The caller passes data in and gets blocks out — this module never reads files or
 * the network, so it is fully unit-testable and cannot break anything.
 *
 *   const { computeBlocks } = require('./worklog-blocks.js');
 *   computeBlocks(sessions, entries, { maxGap: 90, minBlock: 15 }) -> [{start,end,project,notes}]
 */

function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function toHHMM(min) {
  min = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

// Dedup sessions by sessionId (E5): keep the widest interval per id.
function dedupeSessions(sessions) {
  const byId = new Map();
  const anon = [];
  for (const s of sessions || []) {
    if (!s || !s.start || !s.end) continue;
    if (!s.sessionId) { anon.push(s); continue; }
    const cur = byId.get(s.sessionId);
    if (!cur) byId.set(s.sessionId, { ...s });
    else {
      if (toMin(s.start) < toMin(cur.start)) cur.start = s.start;
      if (toMin(s.end) > toMin(cur.end)) cur.end = s.end;
    }
  }
  return [...byId.values(), ...anon];
}

// sessions: [{start:"HH:MM", end:"HH:MM", project, sessionId?}]  (one day)
// entries:  [{time:"HH:MM", project, msg}]                       (one day)
// returns:  [{start, end, project, notes:[...]}] sorted by start
function computeBlocks(sessions, entries, opts = {}) {
  const maxGap = opts.maxGap != null ? opts.maxGap : 90;
  const minBlock = opts.minBlock != null ? opts.minBlock : 15;

  const ents = (entries || [])
    .filter((e) => e && e.time)
    .map((e) => ({ project: e.project || 'misc', msg: e.msg || '', m: toMin(e.time) }))
    .sort((a, b) => a.m - b.m);

  const raw = [];
  for (const s of dedupeSessions(sessions)) {
    const sStart = toMin(s.start);
    let sEnd = toMin(s.end);
    if (sEnd < sStart) sEnd = sStart; // same-day guard (midnight split happens at capture time, E6)

    const inside = ents.filter((e) => e.m >= sStart && e.m <= sEnd);
    if (inside.length === 0) continue; // E7: no logged work -> no block (under-claim, don't invent)

    // split into streaks: consecutive same-project entries within maxGap
    const streaks = [];
    let cur = null;
    for (const e of inside) {
      if (cur && e.project === cur.project && e.m - cur.lastM <= maxGap) {
        cur.lastM = e.m;
        cur.notes.push(e.msg);
      } else {
        cur = { project: e.project, firstM: e.m, lastM: e.m, notes: [e.msg] };
        streaks.push(cur);
      }
    }

    streaks.forEach((st, i) => {
      let startM = st.firstM;
      let endM = st.lastM;
      // anchor first/last streak to real session edges, but only if not separated by idle (> maxGap)
      if (i === 0 && st.firstM - sStart <= maxGap) startM = sStart;
      if (i === streaks.length - 1 && sEnd - st.lastM <= maxGap) endM = sEnd;
      if (endM - startM < minBlock) startM = Math.max(sStart, endM - minBlock);
      raw.push({ start: startM, end: endM, project: st.project, notes: st.notes.slice() });
    });
  }

  // merge same-project blocks that overlap or touch (handles back-to-back / concurrent same-project).
  // NOTE: only merges when there is NO real gap (b.start <= last.end) — never bridges idle time.
  raw.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const b of raw) {
    const last = merged[merged.length - 1];
    if (last && last.project === b.project && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
      last.notes.push(...b.notes);
    } else {
      merged.push({ ...b, notes: b.notes.slice() });
    }
  }

  return merged.map((b) => ({ start: toHHMM(b.start), end: toHHMM(b.end), project: b.project, notes: b.notes }));
}

module.exports = { computeBlocks, dedupeSessions, toMin, toHHMM };
