#!/usr/bin/env node
/*
 * worklog.js — single entry point for the Work Journal terminal CLI.
 *
 * Thin dispatcher: `worklog <verb> [...]` routes to the underlying worklog-*.js scripts, so from a
 * terminal you only need ONE path/name instead of remembering which script does what. The verbs mirror
 * the /worklog chat actions exactly.
 *
 *   node worklog.js                       show settings
 *   node worklog.js show                  print today's journal
 *   node worklog.js status                unified status
 *   node worklog.js log "text"            add an entry   (also: log --project X "text")
 *   node worklog.js summary | week        generate today's / this week's summary
 *   node worklog.js send [email|calendar] deliver now to enabled target(s)
 *   node worklog.js update [--check]      update from the local setup folder
 *   node worklog.js push | unpush [DATE]  mirror the day to your own calendar / remove it
 *   node worklog.js help                  full command list
 *   node worklog.js email off | weekly.day Sunday | language English | ...   settings (pass-through)
 */

const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./worklog-lib.js');

const HERE = __dirname;
function run(script, extra) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...extra], { stdio: 'inherit' });
  process.exit(r.status == null ? 1 : r.status);
}

const argv = process.argv.slice(2);
const verb = argv[0];
const rest = argv.slice(1);

// Verbs worklog-config.js already understands — passed straight through (settings + status + help).
const CONFIG_VERBS = new Set([
  'status', 'help', 'email', 'weekly', 'calendar', 'language',
  'email.time', 'email.days', 'email.to', 'weekly.day', 'weekly.time', 'calendar.summary',
]);

if (!verb) run('worklog-config.js', []); // no args → show current settings

switch (verb) {
  case 'show': {
    const txt = lib.readIf(lib.dailyFile(lib.now()));
    process.stdout.write(txt && txt.trim() ? txt : 'אין רשומות עדיין היום.\n');
    process.exit(0);
  }
  case 'summary': run('worklog-summary.js', ['--daily', ...rest]);
  case 'week': run('worklog-summary.js', ['--weekly', ...rest]);
  case 'send': {
    const tgt = rest[0];
    const only = (tgt === 'email' || tgt === 'calendar') ? ['--only', tgt] : [];
    run('worklog-summary.js', ['--daily', '--deliver', ...only]);
  }
  case 'update': run('worklog-update.js', rest);
  case 'push': run('worklog-calendar.js', ['--push', ...rest]);
  case 'unpush': run('worklog-calendar.js', ['--unpush', ...rest]);
  case 'log': {
    if (rest.includes('--msg')) run('worklog-log.js', rest); // already explicit
    const proj = [];
    let msgParts = rest;
    const pi = rest.indexOf('--project');
    if (pi >= 0) { proj.push('--project', rest[pi + 1]); msgParts = rest.slice(0, pi).concat(rest.slice(pi + 2)); }
    const msg = msgParts.join(' ').trim();
    if (!msg) { console.error('worklog log: חסר טקסט. דוגמה:  worklog log "מה עשיתי"'); process.exit(2); }
    run('worklog-log.js', ['--msg', msg, ...proj]);
  }
  default:
    if (CONFIG_VERBS.has(verb)) run('worklog-config.js', argv); // status / help / settings pass-through
    console.error('worklog: פקודה לא מוכרת "' + verb + '".\n');
    run('worklog-config.js', ['help']);
}
