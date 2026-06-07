# ארכיטקטורה — Work Journal

תיעוד טכני של איך המערכת בנויה ועובדת. קהל יעד: מי שמתחזק/מרחיב את המוצר.

---

## תרשים שכבות

```
┌─────────────────────────────────────────────────────────────────┐
│  כל סשן Claude Code (בכל פרויקט)                                  │
│                                                                   │
│  1) SessionStart hook  ──►  מזריק יומן היום+אתמול + הוראת תיעוד    │
│     (worklog-session-start.js)   וכותב .sessions/<id>.json        │
│                                                                   │
│  2) במהלך הסשן: קלוד מריץ worklog-log.js בנקודות מפתח              │
│     (מודרך ע"י ההזרקה + CLAUDE.md)                                │
│                                                                   │
│  3) SessionEnd hook  ──►  אם לא תועד כלום → רשומת fallback         │
│     (worklog-session-end.js)     ומנקה את ה-marker                │
└─────────────────────────────────────────────────────────────────┘
                              │  כותבים אל
                              ▼
        C:/Users/sarit/.claude/work-journal/YYYY-MM-DD.md
                              │
                              │  נקרא ע"י
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Windows Task Scheduler                                           │
│   • WorkJournal-Notify      18:00 א׳-ה׳  → --daily (התראה בלבד)    │
│   • WorkJournal-DailyEmail  20:30 א׳-ה׳  → --daily --email (סופי)  │
│   • WorkJournal-Weekly      ראשון 08:00  → --weekly --email        │
│   (מבוסס config.json דרך worklog-schedule; מייל opt-in)            │
│            │                                                      │
│            ▼  מריץ claude -p (WORKLOG_DISABLE=1), node כותב הקובץ  │
│   summary-YYYY-MM-DD.md   /   YYYY-Www-weekly.md                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## רכיבים, קובץ-קובץ

### `worklog-lib.js` — ליבת העזר (CommonJS, ללא תלויות)
- `ROOT = ~/.claude/work-journal`, `SESSIONS = ROOT/.sessions`.
- `dateKey(d)` → `YYYY-MM-DD`; `timeKey(d)` → `HH:MM`; `hebDow(d)` → אות יום עברית (א׳…שבת, ראשון-ראשון).
- `dailyFile / summaryFile / weeklyFile` — בנאי נתיבים. `weeklyFile` משתמש ב-`isoWeekParts` (שבוע ISO-8601).
- `projectFromCwd(cwd)` — הסגמנט אחרי `youleap/`, אחרת basename. ברירת מחדל `misc`.
- `appendEntry({project, message, time})` — יוצר קובץ יום עם כותרת אם חסר, ומוסיף `- HH:MM [project] msg`.

### `worklog-log.js` — CLI הוספת רשומה
- פרסור: `--project/-p`, `--msg/-m`, וגם פוזיציוני (`project` אז `msg`).
- אם אין project → `projectFromCwd(process.cwd())`. כש-Claude מריץ דרך Bash, ה-cwd = תיקיית הפרויקט.

### `worklog-session-start.js` — hook SessionStart
- קורא JSON מ-stdin (`fs.readFileSync(0)`): `session_id, cwd, source`.
- **Recursion guard**: אם `WORKLOG_DISABLE=1` → יוצא מיד (0).
- כותב `.sessions/<sanitized-id>.json` עם `{session_id, cwd, project, startDate, startTime, source}`.
- בונה הקשר (≤ ~9500 תווים, מגבלת `additionalContext` היא 10k): הוראת תיעוד + הפקודה המדויקת
  (נבנית דינמית מ-`process.execPath` ו-`__dirname` → **ניתן-להעברה**) + יומן היום (≤6000) + אתמול (≤1500).
- מחזיר `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` ב-stdout, exit 0.

### `worklog-session-end.js` — hook SessionEnd (רשת ביטחון)
- קורא stdin: `session_id, transcript_path, reason`. **Recursion guard** זהה.
- טוען את ה-marker; `loggedThisSession()` סורק את קובץ היום לרשומה ב-`HH:MM >= startTime` (אותו יום).
- אם לא תועד → `analyzeTranscript()` מוציא את הבקשה האנושית הראשונה (`type:"user"` עם בלוק `text`,
  לא `tool_result`, לא עוטף `<...>`) וסופר בקשות. אם `count >= 2` ויש טקסט → כותב `(אוטו) <snippet>`.
- **לוכד את מרווח הסשן** ל-`.sessions/<date>.jsonl` (`{start,end,project,sessionId}`, פיצול-חצות E6) — הבסיס לבלוקי היומן.
- **מסנכרן יומן (v0.7.3):** אם `calendar.enabled` והסשן תרם עבודה → spawn **detached** של `worklog-calendar.js --sync` ליום/לימים (פיצול-חצות) — fire-and-forget, לא חוסם סגירה. כך היומן הוא mirror מתמשך (לא רק ב-20:30).
- תמיד מנקה את ה-marker. Exit 0 (לא-חוסם).

### `worklog-summary.js` — מחולל הסיכום
- דגלים: `--daily` (ברירת מחדל), `--weekly`, `--date YYYY-MM-DD` (override לבדיקה), `--deliver` (דליברי on-demand), `--only email|calendar` (בורר יעד), `--email` (**alias תאימות-לאחור** ל-`--deliver`; ה-scheduler משתמש בו).
- `resolveClaude()`: `WORKLOG_CLAUDE` → `%APPDATA%/npm/claude.cmd` → `claude` (PATH).
- `claudeSummarize(prompt)`: `spawnSync(claude, ['-p'], {input:prompt, shell:true, env:{...,WORKLOG_DISABLE:'1'}})`.
  **קלוד מדפיס ל-stdout; node כותב את הקובץ** (אין צורך בהרשאת Write בהרצה headless).
- **שפת פלט:** קורא `config.language` (ברירת מחדל עברית) ומזריק שורת-הוראה לראש ה-prompt (יומי+שבועי) — קלוד כותב את כל הסיכום בשפה זו (תוכן בלבד; אפס טוקנים נוספים).
- `fallbackSummary()`: אם קלוד נכשל/לא זמין → מקבץ רשומות לפי פרויקט (ללא AI). הקובץ תמיד נוצר.
- **דליברי:** `want.deliver = --deliver || --email`; `deliverEmail`/`deliverCalendar` נגזרים מ-`--only`. שולח **רק ליעד מופעל**. 18:00 רץ בלי דליברי (ביניים); 20:30 עם `--email` (סופי). **גארד:** אם אין רשומות היום → נכתב placeholder, ו**אין** דליברי.
- שבועי: אוסף את **7 הימים שקדמו להיום** (עד אתמול) — "השבוע שעבר" כשרץ ראשון בבוקר. כולל חלק "נשאר פתוח".
- אחרי הכתיבה: `worklog-notify.js` (התראה לחיצה; הכותרת משקפת 📧/🗓️ כשנשלח) + `worklog-email.js` (אם דליברי-מייל ומופעל) + `worklog-calendar.js --sync` (spawn נפרד fail-safe, אם דליברי-יומן ומופעל).

### `worklog-notify.js` — התראת toast לחיצה
- Windows: WinRT toast תחת ה-AppId של PowerShell (ללא מודול/רישום). מקבל `title, message, launchPath`.
- `launchPath` → `activationType='protocol'` + כפתורי "פתח סיכום"/"פתח תיקייה" (פותח קובץ/תיקייה ב-shell).
- fail-safe (לא זורק), no-op אם `WORKLOG_NO_NOTIFY=1`. mac: `osascript` · linux: `notify-send`.

### `worklog-email.js` — מייל אופציונלי (Gmail/SMTP)
- `--setup` (אינטראקטיבי): **כל הקלט ב-PowerShell יחיד** (prompts באנגלית למניעת היפוך-RTL ב-console; קורא-stdin אחד למניעת race של ה-`Read-Host`). כתובת/host/port + App Password (מוסתר) → מצפין **DPAPI** ל-`.email-cred`, מחזיר שדות ל-Node דרך JSON זמני, כותב `config.json`, רושם מחדש משימות.
- `sendSummary()`: ממיר את ה-Markdown ל-**HTML** (`worklog-format.toHtml`) ושולח `Send-MailMessage -BodyAsHtml -UseSsl` עם סיסמה מפוענחת DPAPI. `emailEnabled()` בודק enabled+cred.
- `--test` שולח מייל בדיקה. כבוי כברירת מחדל.

### `worklog-config.js` — מנוע הגדרות
- קורא/ממזג/כותב `config.json`. CLI: `email on/off`, `email.time`, `email.days` (תומך `Sun-Thu`),
  `weekly.day/time/off`, `calendar on/off`, `language <free-form>`. **כל שינוי קורא ל-`registerTasks` → רישום מחדש** (אין drift הגדרות↔תזמון).
- `status` — תצוגת-על (read-only): פעילות היום (רשומות+פרויקטים, האם הסיכום נוצר) + יעדים (on/off + מצב cred) + שפה + `describe()`.
- `help` — מדפיס את כל הפקודות (סקיל `/worklog` + ה-CLI הישיר). נקרא מ-`/worklog help`.

### `worklog-schedule.js` — רישום משימות מ-config (משותף ל-install/config/email/calendar)
- `defaultConfig()` (כולל `language: 'עברית'`), `parseDays()`, `registerTasks(...)`, `describe()` (כולל שורת שפה).
- רישום = איפוס מלא (Unregister-all → register applicable), כולל ניקוי `WorkJournal-Daily` הישן.
- בונה: `WorkJournal-Notify` (18:00 א׳–ה׳, קבוע) · `WorkJournal-DailyEmail` (אם email **או** calendar מופעלים) · `WorkJournal-Weekly` (אם email.enabled).

### `worklog-blocks.js` — חישוב בלוקים (טהור, 0 AI)
- `computeBlocks(sessions, entries, {maxGap,minBlock})` → בלוקים מעוגני-סשנים, גזומי-פערים; ללא I/O; `dedupeSessions` ל-E5; `streaksOf` משותף.
- **Fallback מבוסס-רשומות (v0.7.4):** רשומות שלא נופלות בתוך אף session עדיין הופכות לבלוקים (streaks לפי פרויקט+פער) — כך עבודה לא אובדת כש-session capture חלקי/חסר. (תוקן באג שזרק 92% מהעבודה כשנלכד רק סשן אחד.)

### `worklog-format.js` — המרת פורמט פר-יעד (v0.7.4, טהור)
- `toHtml(md)` → HTML למייל (`-BodyAsHtml`): `#`→`<h2..h4>`, `- `→`<ul><li>`, `**`→`<b>`, עטיפת RTL.
- `toCalHtml(md)` → ה-subset שגוגל קלנדר מרנדר (`<b>`/`<ul>`/`<li>`/`<br>`; ללא `<h>`/`<div>`/style) — לתיאור אירוע "סיכום היום".
- `toPlain(md)` → טקסט נקי (fallback/toast). **מבנה בלבד, לא תוכן.**

### `worklog-calendar.js` — סנכרון Google Calendar (אופציונלי)
- `--setup` (OAuth2 loopback, `--env`/prompt) · `--test` · `--sync [date]` · `--disable`.
- Token `{client_id,client_secret,refresh_token}` מוצפן **DPAPI** ב-`.calendar-cred`; access token מתחדש בכל ריצה (REST, ללא npm).
- `--sync`: סשני-היום + רשומות הלוג → `computeBlocks` → אירועי בלוק (timed) + "סיכום היום" (all-day, תיאור = **`toCalHtml`** של הסיכום) → **regenerate-and-replace** לפי תיוג `worklog=<date>`, ביומן הייעודי "Work Journal" בלבד.
- נקרא כ-`--sync` משני מקומות (spawn fail-safe): **`worklog-session-end.js`** בכל סגירת סשן (mirror מתמשך — בלוקים) ו-**`worklog-summary.js`** בריצת ה-20:30 (בלוקים + חידוש אירוע הסיכום). מקור המרווחים: `.sessions/<date>.jsonl`.

---

## פורמט הנתונים

**לוג יומי** (`YYYY-MM-DD.md`):
```
# 2026-06-04 (ה׳)

- 09:14 [someSkills] תיאור קצר
- 14:05 [espircom] PR #421 מוזג
```
רשומה: `- HH:MM [project] message`. רשומות אוטומטיות מסומנות `(אוטו)`.

**Marker** (`.sessions/<id>.json`): `{session_id, cwd, project, startDate, startTime, source}`.

---

## נקודות אינטגרציה עם ה-harness

- **SessionStart stdin**: `session_id, transcript_path, cwd, permission_mode, source(startup|resume|clear|compact), model`.
- **SessionStart הזרקה**: רק דרך `hookSpecificOutput.additionalContext` (≤10k תווים), exit 0.
- **SessionEnd stdin**: `session_id, transcript_path, cwd, reason(clear|resume|logout|prompt_input_exit|bypass_permissions_disabled|other)`. לא-חוסם, לא מזריק הקשר.
- **Transcript JSONL**: שורה לכל אירוע; `type` ברמה העליונה (`user`/`assistant`/`queue-operation`/`attachment`/…).
  הודעת אדם אמיתית = `type:"user"` עם `message.content` מערך שמכיל בלוק `{type:"text"}` (לא `tool_result`).

---

## תלות-סביבה ומגבלות ניידוּת (לקראת הפצה)

- ה-hooks עצמם **ניידים** (משתמשים ב-`os.homedir()`, `__dirname`, `process.execPath`).
- **לא ניידים** כרגע, וה-installer יצטרך לטפל בהם:
  - נתיבים קשיחים ב-`CLAUDE.md`, ב-`skill/SKILL.md`, ובפקודות ה-hook ב-`settings.json`.
  - תזמון: Windows Task Scheduler בלבד. macOS → `launchd`/`cron`; Linux → `cron`.
  - איתור `claude` ו-node משתנה בין מכונות.
