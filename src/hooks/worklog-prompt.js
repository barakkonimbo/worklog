#!/usr/bin/env node
// worklog-prompt.js — UserPromptSubmit hook: a per-prompt activity heartbeat.
//
// Before every response, stamp the current time + project to the day's activity file. This is the
// dense, automatic signal the Google Calendar mirror uses to compute accurate work blocks (same-
// project stamps within 30 min form one block; each block is extended ~10 min past its last stamp).
//
// Two-layer design (see docs/CALENDAR-SPEC.md):
//   • this layer = activity stamps (TIME only, no content) -> drives block boundaries.
//   • the content layer = key-point entries in the daily .md (what Claude logs) -> drives the AI summary.
// Keeping them separate means dense, accurate blocks WITHOUT flooding the summary with noise.
//
// Contract: writes NO content and prints NOTHING to stdout (UserPromptSubmit stdout would be injected
// as context), runs in a few ms, and can never block or fail a prompt. Wired under hooks.UserPromptSubmit.

const fs = require('fs');
const lib = require('./worklog-lib.js');

// Recursion guard: the summary generator spawns `claude -p` with WORKLOG_DISABLE=1 (inherited by
// child procs), so this hook does nothing during a headless summary run.
if (process.env.WORKLOG_DISABLE === '1') process.exit(0);

function readStdin() { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } }

try {
  let data = {};
  try { data = JSON.parse(readStdin() || '{}'); } catch { data = {}; }
  lib.appendActivity({ project: lib.projectFromCwd(data.cwd || process.cwd()) });
} catch { /* never block a prompt over a logging hiccup */ }

process.exit(0);
