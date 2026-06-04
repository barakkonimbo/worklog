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
 *   node worklog-config.js calendar off|on      toggle Google Calendar sync (needs --setup first)
 *   node worklog-config.js calendar.summary off toggle the all-day "summary" event in Calendar
 *   node worklog-config.js language English      set the AI summary output language (free-form)
 *   node worklog-config.js status                unified status: today's activity + targets + schedule
 *
 * Multiple changes in one call are allowed. Config lives in ~/.claude/work-journal/config.json.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const schedule = require('./worklog-schedule.js');
const lib = require('./worklog-lib.js');

const ROOT = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, 'work-journal')
  : path.join(os.homedir(), '.claude', 'work-journal');
const CONFIG = path.join(ROOT, 'config.json');
const NODE = process.execPath;
const SUMMARY = path.join(__dirname, 'worklog-summary.js');
const CRED = path.join(ROOT, '.email-cred');
const CAL_CRED = path.join(ROOT, '.calendar-cred');

function load() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { /* defaults */ }
  const d = schedule.defaultConfig();
  return {
    language: c.language || d.language,
    email: { ...d.email, ...(c.email || {}) },
    weekly: { ...d.weekly, ...(c.weekly || {}) },
    calendar: { ...d.calendar, ...(c.calendar || {}) },
  };
}
function save(c) { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n', 'utf8'); }
function applyTasks(c) { return schedule.registerTasks({ node: NODE, summaryScript: SUMMARY, config: c }); }

function show(c) {
  console.log('— הגדרות Work Journal —\n');
  console.log(schedule.describe(c));
  if (c.email && c.email.enabled && !fs.existsSync(CRED)) {
    console.log('\n⚠️  מייל מופעל אבל אין סיסמה שמורה — הריצו:  node "' + path.join(__dirname, 'worklog-email.js').replace(/\\/g, '/') + '" --setup');
  }
  if (c.calendar && c.calendar.enabled && !fs.existsSync(CAL_CRED)) {
    console.log('\n⚠️  יומן מופעל אבל אין token שמור — הריצו:  node "' + path.join(__dirname, 'worklog-calendar.js').replace(/\\/g, '/') + '" --setup');
  }
}

// Unified status view: today's activity + targets + schedule + language (for `/worklog status`).
function status(c) {
  const today = lib.now();
  const re = /^- (\d{2}:\d{2}) \[([^\]]+)\] (.+)$/;
  let count = 0; const projects = new Set();
  for (const ln of lib.readIf(lib.dailyFile(today)).split('\n')) {
    const m = re.exec(ln.trim());
    if (m) { count++; projects.add(m[2]); }
  }
  console.log('— Work Journal · סטטוס · ' + lib.dateKey(today) + ' (' + lib.hebDow(today) + ') —\n');
  console.log('📋 היום: ' + (count ? count + ' רשומות · פרויקטים: ' + [...projects].join(', ') : 'אין רשומות עדיין'));
  console.log('   סיכום יומי: ' + (fs.existsSync(lib.summaryFile(today)) ? 'נוצר ✓' : 'טרם נוצר'));
  console.log('');
  show(c); // targets + schedule + language + cred warnings
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
    case 'calendar':
      if (on(val)) c.calendar.enabled = true; else if (off(val)) c.calendar.enabled = false; else return false;
      return true;
    case 'calendar.summary':
      if (on(val)) c.calendar.summaryEvent = true; else if (off(val)) c.calendar.summaryEvent = false; else return false;
      return true;
    case 'language':
      if (!val || !String(val).trim()) return false;
      c.language = String(val).trim();
      return true;
    default: return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const c = load();
  if (!args.length) { show(c); return; }
  if (args[0] === 'status') { status(c); return; }

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
