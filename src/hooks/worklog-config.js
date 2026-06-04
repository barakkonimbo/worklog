#!/usr/bin/env node
/*
 * worklog-config.js — easy settings for the work journal. Every change also
 * re-registers the scheduled tasks, so settings and schedule never drift.
 *
 *   node worklog-config.js                      show current settings
 *   node worklog-config.js email off            disable email delivery (keeps saved password)
 *   node worklog-config.js email on             enable email delivery
 *   node worklog-config.js email.time 20:30     set daily email time   (also: email.time=20:30)
 *   node worklog-config.js email.days Sun-Thu   set days (Sun-Thu | Sun,Mon,Tue,Wed,Thu)
 *   node worklog-config.js weekly off|on        toggle weekly email
 *   node worklog-config.js weekly.day Sunday    set weekly day
 *   node worklog-config.js weekly.time 08:00    set weekly time
 *
 * Multiple changes in one call are allowed. Config lives in ~/.claude/work-journal/config.json.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const schedule = require('./worklog-schedule.js');

const ROOT = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, 'work-journal')
  : path.join(os.homedir(), '.claude', 'work-journal');
const CONFIG = path.join(ROOT, 'config.json');
const NODE = process.execPath;
const SUMMARY = path.join(__dirname, 'worklog-summary.js');
const CRED = path.join(ROOT, '.email-cred');

function load() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { /* defaults */ }
  const d = schedule.defaultConfig();
  return { email: { ...d.email, ...(c.email || {}) }, weekly: { ...d.weekly, ...(c.weekly || {}) } };
}
function save(c) { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n', 'utf8'); }
function applyTasks(c) { return schedule.registerTasks({ node: NODE, summaryScript: SUMMARY, config: c }); }

function show(c) {
  console.log('— הגדרות Work Journal —\n');
  console.log(schedule.describe(c));
  if (c.email && c.email.enabled && !fs.existsSync(CRED)) {
    console.log('\n⚠️  מייל מופעל אבל אין סיסמה שמורה — הריצו:  node "' + path.join(__dirname, 'worklog-email.js').replace(/\\/g, '/') + '" --setup');
  }
}

// Apply one "key value" / "key=value" / "email on|off" / "weekly on|off" change to config.
function applyChange(c, key, val) {
  key = key.toLowerCase();
  const on = (v) => /^(on|true|yes|1)$/i.test(v);
  const off = (v) => /^(off|false|no|0)$/i.test(v);
  switch (key) {
    case 'email':
      if (on(val)) c.email.enabled = true; else if (off(val)) c.email.enabled = false; else return false;
      return true;
    case 'weekly':
      if (on(val)) c.weekly.enabled = true; else if (off(val)) c.weekly.enabled = false; else return false;
      return true;
    case 'email.time': c.email.time = val; return true;
    case 'email.days': c.email.days = schedule.parseDays(val); return true;
    case 'email.to': c.email.to = val; return true;
    case 'weekly.day': c.weekly.day = schedule.parseDays(val)[0] || 'Sunday'; return true;
    case 'weekly.time': c.weekly.time = val; return true;
    default: return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const c = load();
  if (!args.length) { show(c); return; }

  // tokenize into [key, value] pairs supporting "k=v" and "k v" and "email on"
  const changes = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.includes('=')) { const [k, v] = a.split('='); changes.push([k, v]); }
    else { changes.push([a, args[i + 1] || '']); i++; }
  }

  let applied = 0;
  for (const [k, v] of changes) {
    if (applyChange(c, k, v)) applied++;
    else console.error('לא זוהה: ' + k + ' ' + v);
  }
  if (!applied) { console.error('\nאין שינוי תקין. ראו דוגמאות בראש הקובץ.'); show(c); process.exit(1); }

  // enabling email without a saved password? warn but still save (they can run --setup after)
  save(c);
  const res = applyTasks(c);
  console.log('✅ נשמר ועודכנו המשימות המתוזמנות' + (res.ok ? '' : ' (אזהרה: רישום המשימות נכשל — ' + (res.stderr || res.reason || '') + ')') + '\n');
  show(c);
}

module.exports = { load, save, applyTasks };

if (require.main === module) main();
