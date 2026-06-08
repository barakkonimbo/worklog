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
 *   node worklog-config.js help                  list every command (skill + CLI)
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
  let count = 0; const projects = new Set();
  for (const ln of lib.readIf(lib.dailyFile(today)).split('\n')) {
    const e = lib.parseEntryLine(ln);
    if (e) { count++; projects.add(e.project); }
  }
  console.log('— Work Journal · סטטוס · ' + lib.dateKey(today) + ' (' + lib.hebDow(today) + ') —\n');
  console.log('📋 היום: ' + (count ? count + ' רשומות · פרויקטים: ' + [...projects].join(', ') : 'אין רשומות עדיין'));
  console.log('   סיכום יומי: ' + (fs.existsSync(lib.summaryFile(today)) ? 'נוצר ✓' : 'טרם נוצר'));
  console.log('');
  show(c); // targets + schedule + language + cred warnings
}

// Full command reference — skill + CLI — for `/worklog help`.
function help() {
  const H = __dirname.replace(/\\/g, '/');
  const J = lib.ROOT.replace(/\\/g, '/');
  const q = (f) => 'node "' + H + '/' + f + '"';
  const w = (sub) => 'node "' + H + '/worklog.js" ' + sub; // unified terminal dispatcher
  console.log(`— Work Journal · עזרה · כל הפקודות —

כל פעולה זמינה גם בצ'אט וגם בטרמינל. בטרמינל הכל דרך פקודה אחת (worklog.js) —
העתק-הדבק את שורת "טרמינל". (התקנת מייל/יומן ראשונית — בתחתית.)

• רשומה ידנית ליומן
    צ'אט:    /worklog <טקסט>
    טרמינל:  ${w('log "טקסט"')}
• הצגת יומן היום
    צ'אט:    /worklog show
    טרמינל:  ${w('show')}
• תמונת-מצב (היום + יעדים + שפה + תזמון)
    צ'אט:    /worklog status
    טרמינל:  ${w('status')}
• סיכום יומי עכשיו (יצירה בלבד)
    צ'אט:    /worklog summary
    טרמינל:  ${w('summary')}
• סיכום שבועי עכשיו
    צ'אט:    /worklog week
    טרמינל:  ${w('week')}
• שליחה עכשיו לכל יעד מופעל (מייל/יומן)
    צ'אט:    /worklog send  ·  send email  ·  send calendar
    טרמינל:  ${w('send')}  ·  ${w('send email')}  ·  ${w('send calendar')}
• עדכון מהתיקייה המקומית (בודק תוכן · מסביר · מסמן פעולות)
    צ'אט:    /worklog update
    טרמינל:  ${w('update')}    (תצוגה בלבד: ${w('update --check')})
• מירור היום ליומן שלך (push) / הסרה (unpush) — מירור מלא, לא מחליף את Work Journal
    צ'אט:    /worklog push  ·  /worklog unpush
    טרמינל:  ${w('push')}  ·  ${w('unpush')}    (בחירת יומן-יעד: ${q('worklog-calendar.js')} --push-setup)
• הגדרות (מייל/יומן/שבועי/שפה)
    צ'אט:    "כבה מייל" · "תשלח ב-21:00" · "שבועי ביום ה׳" · "שפה לאנגלית"
    טרמינל:  ${w('email on|off')} · ${w('email.time 21:00')} · ${w('email.days Sun-Thu')}
             ${w('weekly on|off')} · ${w('weekly.day Sunday')} · ${w('weekly.time 08:00')}
             ${w('calendar on|off')} · ${w('language English')}
             ${w('autopush on|off')} · ${w('push.calendar primary')}  (מירור אוטומטי ליומן שלך בסוף יום)
• עזרה (המסך הזה)
    צ'אט:    /worklog help
    טרמינל:  ${w('help')}

ישירות (setup/מתקדם — קלט מוסתר, הרץ בטרמינל שלך):
  ${q('worklog-email.js')} --setup | --test | --disable
  ${q('worklog-calendar.js')} --setup | --test | --sync | --disable
  ${q('worklog-summary.js')} --daily|--weekly [--deliver] [--only email|calendar] [--date YYYY-MM-DD]

⏰ אוטומטי (Task Scheduler): 18:00 התראה · 20:30 מייל+יומן (אם מופעל) · ראשון 08:00 שבועי
📂 נתונים וסיכומים: ${J}`);
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
    case 'push.calendar': // target for /worklog push: 'primary' or a calendar ID (name-picking is --push-setup)
      if (!val || !String(val).trim()) return false;
      c.calendar.pushCalendarId = String(val).trim();
      return true;
    case 'autopush': // opt-in auto end-of-day mirror to pushCalendarId (defaults to 'primary' target)
      if (on(val)) c.calendar.autoPush = true; else if (off(val)) c.calendar.autoPush = false; else return false;
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
  if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') { help(); return; }

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
