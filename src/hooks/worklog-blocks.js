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

// Split a (time-sorted) entry list into streaks: consecutive same-project entries within maxGap.
// Shared by the session-anchored path and the fallback path.
function streaksOf(ents, maxGap) {
  const streaks = [];
  let cur = null;
  for (const e of ents) {
    if (cur && e.project === cur.project && e.m - cur.lastM <= maxGap) {
      cur.lastM = e.m;
      cur.notes.push(e.msg);
    } else {
      cur = { project: e.project, firstM: e.m, lastM: e.m, notes: [e.msg] };
      streaks.push(cur);
    }
  }
  return streaks;
}

// Split a (time-sorted) ACTIVITY list into streaks: consecutive same-project stamps within maxGap.
// Like streaksOf, but stamps carry no message (time-only heartbeat), so there are no notes to gather.
function streaksOfActivity(acts, maxGap) {
  const streaks = [];
  let cur = null;
  for (const a of acts) {
    if (cur && a.project === cur.project && a.m - cur.lastM <= maxGap) {
      cur.lastM = a.m;
    } else {
      cur = { project: a.project, firstM: a.m, lastM: a.m };
      streaks.push(cur);
    }
  }
  return streaks;
}

// sessions:  [{start:"HH:MM", end:"HH:MM", project, sessionId?}]  (one day)
// entries:   [{time:"HH:MM", project, msg}]                       (one day; the CONTENT layer)
// opts.activity: [{time:"HH:MM", project}]                        (one day; dense per-prompt stamps)
// returns:   [{start, end, project, notes:[...]}] sorted by start
//
// Two models, picked automatically:
//   • When per-prompt activity stamps exist (the normal case after install), THEY define block times:
//     same-project stamps within `activityGap` (30 min) form one block, whose end is pushed `tail`
//     (10 min) past the last stamp and clamped so it never overlaps the next block. Content entries
//     only supply the notes; any entry not covered by an activity block still becomes its own block.
//   • Otherwise (days before the activity hook existed, or it never fired) fall back to the legacy
//     session-anchored, gap-trimmed model. Behavior there is unchanged.
function computeBlocks(sessions, entries, opts = {}) {
  const maxGap = opts.maxGap != null ? opts.maxGap : 90;
  const minBlock = opts.minBlock != null ? opts.minBlock : 15;
  const activityGap = opts.activityGap != null ? opts.activityGap : 30;
  const tail = opts.tail != null ? opts.tail : 10;
  const activity = opts.activity || [];

  const ents = (entries || [])
    .filter((e) => e && e.time)
    .map((e) => ({ project: e.project || 'misc', msg: e.msg || '', m: toMin(e.time) }))
    .sort((a, b) => a.m - b.m);

  if (activity.length) return blocksFromActivity(activity, ents, { activityGap, tail, minBlock, maxGap });
  return blocksFromSessions(sessions, ents, { maxGap, minBlock });
}

// Activity-stamp model (primary). Stamps drive the times; entries drive the notes.
function blocksFromActivity(activity, ents, { activityGap, tail, minBlock, maxGap }) {
  const acts = (activity || [])
    .filter((a) => a && a.time)
    .map((a) => ({ project: a.project || 'misc', m: toMin(a.time) }))
    .sort((a, b) => a.m - b.m);

  const streaks = streaksOfActivity(acts, activityGap);
  const covered = new Array(ents.length).fill(false);
  const raw = [];

  streaks.forEach((st, i) => {
    const startM = st.firstM;
    let endM = st.lastM + tail;                           // extend the block past its last stamp
    const next = streaks[i + 1];
    if (next && endM > next.firstM) endM = next.firstM;   // but never overlap the following block
    if (endM <= startM) return;                           // instant project switch -> no real duration
    // notes: same-project content entries that fall inside this block's window
    const notes = [];
    ents.forEach((e, j) => {
      if (e.project === st.project && e.m >= startM && e.m <= endM) { notes.push(e.msg); covered[j] = true; }
    });
    raw.push({ start: startM, end: endM, project: st.project, notes });
  });

  // entries with no covering activity block (e.g. a manual `worklog-log` when no prompt fired) still
  // become blocks, so manually-logged work is never lost. Use the sparse content gap (maxGap) + minBlock.
  const uncovered = ents.filter((_, j) => !covered[j]);
  for (const st of streaksOf(uncovered, maxGap)) {
    let startM = st.firstM;
    const endM = st.lastM;
    if (endM - startM < minBlock) startM = Math.max(0, endM - minBlock);
    raw.push({ start: startM, end: endM, project: st.project, notes: st.notes.slice() });
  }
  return mergeAndFormat(raw);
}

// Session-anchored, gap-trimmed model (legacy fallback — unchanged behavior).
function blocksFromSessions(sessions, ents, { maxGap, minBlock }) {
  const covered = new Array(ents.length).fill(false);
  const raw = [];

  // 1) Session-anchored blocks: entries inside a captured session interval, anchored to real edges.
  for (const s of dedupeSessions(sessions)) {
    const sStart = toMin(s.start);
    let sEnd = toMin(s.end);
    if (sEnd < sStart) sEnd = sStart; // same-day guard (midnight split happens at capture time, E6)

    const inside = [];
    ents.forEach((e, i) => { if (e.m >= sStart && e.m <= sEnd) { inside.push(e); covered[i] = true; } });
    if (inside.length === 0) continue; // session with no logged work -> no block (don't invent)

    const streaks = streaksOf(inside, maxGap);
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

  // 2) Fallback blocks: logged entries NOT covered by any captured session STILL become blocks, so work
  // is never lost when session capture is missing/partial (the calendar must reflect all logged work).
  // No session edge to anchor to -> span the streak's own first..last entry; pad a lone entry to minBlock.
  const uncovered = ents.filter((_, i) => !covered[i]);
  for (const st of streaksOf(uncovered, maxGap)) {
    let startM = st.firstM;
    const endM = st.lastM;
    if (endM - startM < minBlock) startM = Math.max(0, endM - minBlock);
    raw.push({ start: startM, end: endM, project: st.project, notes: st.notes.slice() });
  }
  return mergeAndFormat(raw);
}

// merge same-project blocks that overlap or touch (handles back-to-back / concurrent same-project).
// NOTE: only merges when there is NO real gap (b.start <= last.end) — never bridges idle time.
function mergeAndFormat(raw) {
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
