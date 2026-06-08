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

// Group time-only activity stamps into PER-PROJECT streaks: for each project independently, its stamps
// (in time order) split into streaks where each gap to the previous SAME-project stamp is <= maxGap.
// Crucially this is per-project, NOT global-consecutive (unlike streaksOf): hopping to another project
// for a few minutes does NOT break a project's streak, as long as that project resumes within maxGap.
// So "turk … someSkills … turk" within 30 min stays ONE turk block (+ a someSkills block), instead of
// shattering turk into a block per stamp. Returns streaks sorted by start. Stamps carry no notes.
function streaksByProjectActivity(acts, maxGap) {
  const byProject = new Map();
  for (const a of acts) {
    if (!byProject.has(a.project)) byProject.set(a.project, []);
    byProject.get(a.project).push(a.m); // acts is pre-sorted by time → each list stays time-sorted
  }
  const streaks = [];
  for (const [project, times] of byProject) {
    let cur = null;
    for (const m of times) {
      if (cur && m - cur.lastM <= maxGap) cur.lastM = m;
      else { cur = { project, firstM: m, lastM: m }; streaks.push(cur); }
    }
  }
  return streaks.sort((a, b) => a.firstM - b.firstM || a.lastM - b.lastM);
}

// sessions:  [{start:"HH:MM", end:"HH:MM", project, sessionId?}]  (one day)
// entries:   [{time:"HH:MM", project, msg}]                       (one day; the CONTENT layer)
// opts.activity: [{time:"HH:MM", project}]                        (one day; dense per-prompt stamps)
// returns:   [{start, end, project, notes:[...]}] sorted by start
//
// Two models, picked automatically:
//   • When per-prompt activity stamps exist (the normal case after install), THEY define block times,
//     grouped PER PROJECT: a project's stamps within `activityGap` (30 min) of each other form one block
//     (even if another project's stamps interleave in between), whose end is pushed `tail` (10 min) past
//     the project's last stamp. Different projects are independent, so their blocks MAY overlap when work
//     was interleaved. Content entries only supply notes; any entry not covered still becomes its block.
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

  const streaks = streaksByProjectActivity(acts, activityGap);
  const covered = new Array(ents.length).fill(false);
  const raw = [];

  streaks.forEach((st) => {
    const startM = st.firstM;
    const endM = st.lastM + tail;                         // extend the block past its last stamp.
    // No cross-project clamp: each project is independent, so different projects' blocks MAY overlap
    // when work was interleaved (each project gets its own cube). Same-project streaks are >activityGap
    // apart, so the tail (< activityGap) never makes one same-project block overlap the next.
    if (endM <= startM) return;                           // instant -> no real duration
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
