#!/usr/bin/env node
// worklog-summary.js — generate the daily and/or weekly work-journal summary.
//
// Invoked by Windows Task Scheduler (18:00 interim notify, 20:30 final email, Sunday weekly), or manually:
//   node worklog-summary.js --daily               summary for today
//   node worklog-summary.js --weekly              weekly rollup (current ISO week)
//   node worklog-summary.js --daily --weekly      both
//   node worklog-summary.js --daily --date 2026-06-04   (override date, for testing)
//
// Design: Claude is asked to PRINT the summary to stdout (read prompt from stdin,
// run with --bare so it doesn't re-trigger worklog hooks/skills). This Node script
// owns all file writing, so no Write permission is needed in the headless run.
// If Claude is unavailable or fails, a plain grouped-by-project fallback is written.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./worklog-lib.js');
const notifier = require('./worklog-notify.js');
const emailer = require('./worklog-email.js');
const calendar = require('./worklog-calendar.js'); // for calendarEnabled() in the notification title

// ---------- args ----------
const argv = process.argv.slice(2);
const want = {
  daily: argv.includes('--daily'),
  weekly: argv.includes('--weekly'),
  // deliver = "send the summary to every enabled target (email + calendar)". The 18:00 run
  // omits it (interim); the 20:30 run passes it (final). --email is kept as a back-compat
  // alias so the existing scheduled tasks (which pass --email) keep working unchanged.
  deliver: argv.includes('--deliver') || argv.includes('--email'),
};
if (!want.daily && !want.weekly) want.daily = true; // default
// --only email|calendar restricts an on-demand delivery to a single channel (e.g. `send email`).
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? String(argv[onlyIdx + 1] || '').toLowerCase() : null;
const deliverEmail = want.deliver && only !== 'calendar';
const deliverCalendar = want.deliver && only !== 'email';
let baseDate = lib.now();
const di = argv.indexOf('--date');
if (di >= 0 && argv[di + 1]) {
  const [y, m, d] = argv[di + 1].split('-').map(Number);
  if (y && m && d) baseDate = new Date(y, m - 1, d, 12, 0, 0);
}

// ---------- claude resolution ----------
function resolveClaude() {
  if (process.env.WORKLOG_CLAUDE && fs.existsSync(process.env.WORKLOG_CLAUDE)) return process.env.WORKLOG_CLAUDE;
  const npmCmd = path.join(process.env.APPDATA || '', 'npm', 'claude.cmd');
  if (fs.existsSync(npmCmd)) return npmCmd;
  return 'claude'; // hope it's on PATH
}
const CLAUDE = resolveClaude();

// Output language for the AI summary — config.language, default Hebrew (= current behavior).
// Injected into the prompt so the user can receive summaries in any language they choose.
function summaryLanguage() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(lib.ROOT, 'config.json'), 'utf8'));
    const v = cfg.language && String(cfg.language).trim();
    return v || 'עברית';
  } catch { return 'עברית'; }
}
const LANG = summaryLanguage();
const langLine = `**שפת הפלט: ${LANG}.** כתוב את כל הסיכום — כולל כל הכותרות — בשפה זו. (התבנית למטה מוצגת בעברית להמחשת המבנה בלבד.)`;

// Run Claude headless: prompt via stdin, summary text on stdout. Returns string or null.
function claudeSummarize(prompt) {
  try {
    const r = spawnSync(CLAUDE, ['-p'], {
      input: prompt,
      encoding: 'utf8',
      shell: true,             // needed to invoke the .cmd shim on Windows
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 16,
      // WORKLOG_DISABLE stops the headless run from re-triggering the worklog
      // SessionStart/SessionEnd hooks (child procs inherit this env). We avoid
      // --bare on purpose: it also drops the cached login -> "Not logged in".
      env: { ...process.env, WORKLOG_DISABLE: '1' },
    });
    if (r.status === 0 && r.stdout && r.stdout.trim().length > 20) return r.stdout.trim();
    if (r.stderr) console.error('[worklog-summary] claude stderr:', r.stderr.slice(0, 500));
    return null;
  } catch (e) {
    console.error('[worklog-summary] claude spawn failed:', e.message);
    return null;
  }
}

// ---------- fallback (no AI): group entries by project ----------
function fallbackSummary(title, sources) {
  const byProj = {};
  const re = /^- (\d{2}:\d{2}) \[([^\]]+)\] (.+)$/;
  for (const { content } of sources) {
    for (const ln of content.split('\n')) {
      const m = re.exec(ln.trim());
      if (!m) continue;
      const [, time, proj, msg] = m;
      (byProj[proj] = byProj[proj] || []).push(`${time} ${msg}`);
    }
  }
  let out = `# ${title}\n\n> נוצר אוטומטית (ללא סיכום AI — קלוד לא היה זמין).\n\n`;
  const projs = Object.keys(byProj);
  if (!projs.length) return out + '_לא תועדה פעילות._\n';
  for (const p of projs) {
    out += `## ${p}\n`;
    for (const line of byProj[p]) out += `- ${line}\n`;
    out += '\n';
  }
  return out;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : content + '\n', 'utf8');
  console.log('[worklog-summary] wrote', file);
}

// First couple of meaningful lines, for the notification body.
function previewOf(md) {
  const lines = md.split('\n').map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#') && !s.startsWith('>') && !s.startsWith('---'));
  return lines.slice(0, 2).join(' • ').slice(0, 160) || 'הסיכום מוכן';
}

// Calendar sync here runs on the 20:30 end-of-day run (--email) — this run also refreshes the summary
// event. (The continuous mirror — every session close — lives in worklog-session-end.js.) Spawned as a separate
// process so a calendar/network failure can NEVER break the summary, email, or notification.
// worklog-calendar.js self-gates (exits quietly if calendar is disabled).
function trySyncCalendar(dateStr) {
  try {
    const script = path.join(__dirname, 'worklog-calendar.js');
    if (!fs.existsSync(script)) return;
    const r = spawnSync(process.execPath, [script, '--sync', dateStr], {
      encoding: 'utf8', windowsHide: true, timeout: 90000, env: { ...process.env },
    });
    if (r.stdout && r.stdout.trim()) console.log(r.stdout.trim());
    if (r.status !== 0 && r.stderr) console.error('[worklog-summary] calendar sync:', r.stderr.slice(0, 300));
  } catch (e) { console.error('[worklog-summary] calendar sync skipped:', e.message); }
}

// ---------- daily ----------
function doDaily() {
  const file = lib.dailyFile(baseDate);
  const out = lib.summaryFile(baseDate);
  const content = lib.readIf(file).trim();
  const dateStr = `${lib.dateKey(baseDate)} (${lib.hebDow(baseDate)})`;
  if (!content) {
    write(out, `# סיכום יום — ${dateStr}\n\n_לא תועדה פעילות היום._\n`);
    return;
  }
  const prompt =
`${langLine}

אתה כותב סיכום-יום למפתח, על בסיס לוג העבודה הגולמי שלו, ברמת-על — מה נעשה, מתי, באיזה נושא ופרויקט — בלי פרטים טכניים זעירים.

פורמט הפלט (Markdown בלבד, ללא הקדמות וללא טקסט נוסף):
# סיכום יום — ${dateStr}

## לפי פרויקט
(לכל פרויקט שמופיע בלוג: כותרת ### עם שם הפרויקט, ותחתיה 1-4 בולטים של מה נעשה ברמת נושא)

## ציר זמן
(בוקר / צהריים / אחה״צ / ערב — שורה לכל חלק שיש בו פעילות, נושאים עיקריים בלבד)

## בולטים
(2-4 שורות: הישגים, החלטות, או דברים פתוחים שדורשים המשך)

כללים: בסס אך ורק על הלוג, אל תמציא. רשומות שמסומנות "(אוטו)" הן תיעוד אוטומטי גולמי — סכם אותן בזהירות. תמציתי.

--- הלוג הגולמי של ${dateStr} ---
${content}
--- סוף הלוג ---`;
  const ai = claudeSummarize(prompt);
  const finalContent = ai || fallbackSummary(`סיכום יום — ${dateStr}`, [{ content }]);
  write(out, finalContent);
  const emailed = deliverEmail && emailer.emailEnabled() ? emailer.sendSummary('סיכום יום — ' + dateStr, finalContent) : false;
  const toCal = deliverCalendar && calendar.calendarEnabled();
  const tags = (emailed ? ' · 📧 נשלח למייל' : '') + (toCal ? ' · 🗓️ יומן' : '');
  const title = (want.deliver ? '📓 סיכום היום (סופי)' : '📓 סיכום היום מוכן') + ' — ' + dateStr + tags;
  notifier.notify(title, previewOf(finalContent), out);
  // deliver run only: sync the day's blocks + summary to Google Calendar (fail-safe, self-gated)
  if (toCal) trySyncCalendar(lib.dateKey(baseDate));
}

// ---------- weekly ----------
function doWeekly() {
  // summarize the PREVIOUS 7 days (ending yesterday) — a Sunday-morning recap of the week that ended
  const ref = new Date(baseDate); ref.setDate(baseDate.getDate() - 1);
  const sources = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(baseDate); d.setDate(baseDate.getDate() - i);
    const c = lib.readIf(lib.dailyFile(d)).trim();
    if (c) sources.push({ date: lib.dateKey(d), dow: lib.hebDow(d), content: c });
  }
  const { year, week } = lib.isoWeekParts(ref);
  const out = lib.weeklyFile(ref);
  const label = `שבוע ${year}-W${lib.pad(week)} (השבוע שעבר)`;
  if (!sources.length) {
    write(out, `# סיכום ${label}\n\n_לא תועדה פעילות השבוע._\n`);
    return;
  }
  const body = sources.map((s) => `### ${s.date} (${s.dow})\n${s.content}`).join('\n\n');
  const prompt =
`${langLine}

אתה כותב סיכום שבועי למפתח על בסיס לוגים יומיים, ברמת-על: מגמות, נושאים מרכזיים והתקדמות לאורך השבוע לפי פרויקט — לא רשימת אירועים יבשה.

פורמט הפלט (Markdown בלבד, ללא טקסט מקדים):
# סיכום ${label}

## תמונה כללית
(2-4 שורות: מה אפיין את השבוע)

## לפי פרויקט
(לכל פרויקט: ### שם הפרויקט + מה התקדם השבוע ברמת נושאים והישגים)

## נשאר פתוח להמשך
(משימות/נושאים שלא נסגרו וצריך להמשיך בהם — החלק החשוב לתחילת השבוע)

## דגשים
(החלטות חשובות, חסמים, הישגים)

כללים: בסס רק על הלוגים, אל תמציא. אחֵד אירועים חוזרים לכדי נושא. תמציתי.

--- לוגים יומיים של השבוע ---
${body}
--- סוף הלוגים ---`;
  const ai = claudeSummarize(prompt);
  const finalContent = ai || fallbackSummary(`סיכום ${label}`, sources);
  write(out, finalContent);
  const emailed = deliverEmail && emailer.emailEnabled() ? emailer.sendSummary('סיכום שבועי — ' + label, finalContent) : false;
  notifier.notify('🗓️ סיכום שבועי מוכן — ' + label + (emailed ? ' · 📧 נשלח למייל' : ''), previewOf(finalContent), out);
}

if (want.daily) doDaily();
if (want.weekly) doWeekly();
