#!/usr/bin/env node
// worklog-log.js — append one entry to today's work journal.
//
// Usage (called by Claude during a session, or by you manually):
//   node worklog-log.js --project "espircom" --msg "fixed cache bug, PR #421"
//   node worklog-log.js -m "what I just did"            (project inferred from cwd)
//   node worklog-log.js "espircom" "fixed cache bug"    (positional)
//
// Project is inferred from the current working directory when not given.

const lib = require('./worklog-lib.js');

function parse(argv) {
  const a = argv.slice(2);
  let project = null;
  const msgParts = [];
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (t === '--project' || t === '-p') project = a[++i];
    else if (t === '--msg' || t === '-m') msgParts.push(a[++i]);
    else if (project === null && msgParts.length === 0) project = t; // first positional = project
    else msgParts.push(t);
  }
  return { project, msg: msgParts.join(' ').trim() };
}

const { project: rawProject, msg } = parse(process.argv);
if (!msg) {
  console.error('usage: worklog-log.js [--project NAME] --msg "what you did"');
  process.exit(1);
}
const project = rawProject || lib.projectFromCwd(process.cwd());
const { file } = lib.appendEntry({ project, message: msg });
console.log(`worklog: logged [${project}] -> ${file}`);
