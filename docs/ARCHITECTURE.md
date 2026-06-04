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
- תמיד מנקה את ה-marker. Exit 0 (לא-חוסם).

### `worklog-summary.js` — מחולל הסיכום
- דגלים: `--daily` (ברירת מחדל), `--weekly`, `--date YYYY-MM-DD` (override לבדיקה).
- `resolveClaude()`: `WORKLOG_CLAUDE` → `%APPDATA%/npm/claude.cmd` → `claude` (PATH).
- `claudeSummarize(prompt)`: `spawnSync(claude, ['-p'], {input:prompt, shell:true, env:{...,WORKLOG_DISABLE:'1'}})`.
  **קלוד מדפיס ל-stdout; node כותב את הקובץ** (אין צורך בהרשאת Write בהרצה headless).
- `fallbackSummary()`: אם קלוד נכשל/לא זמין → מקבץ רשומות לפי פרויקט (ללא AI). הקובץ תמיד נוצר.
- `--email`: שולח גם מייל (אם מופעל). 18:00 רץ בלי הדגל (ביניים); 20:30 איתו (סופי).
- שבועי: אוסף את **7 הימים שקדמו להיום** (עד אתמול) — "השבוע שעבר" כשרץ ראשון בבוקר. כולל חלק "נשאר פתוח".
- אחרי הכתיבה: `worklog-notify.js` (התראה לחיצה) + `worklog-email.js` (אם `--email` ומופעל).

### `worklog-notify.js` — התראת toast לחיצה
- Windows: WinRT toast תחת ה-AppId של PowerShell (ללא מודול/רישום). מקבל `title, message, launchPath`.
- `launchPath` → `activationType='protocol'` + כפתורי "פתח סיכום"/"פתח תיקייה" (פותח קובץ/תיקייה ב-shell).
- fail-safe (לא זורק), no-op אם `WORKLOG_NO_NOTIFY=1`. mac: `osascript` · linux: `notify-send`.

### `worklog-email.js` — מייל אופציונלי (Gmail/SMTP)
- `--setup` (אינטראקטיבי): כתובת/host/port + App Password (קלט מוסתר), מצפין **DPAPI**
  (`ConvertFrom-SecureString`) ל-`.email-cred`, כותב `config.json`, ורושם מחדש משימות.
- `sendSummary()`: `Send-MailMessage -UseSsl` עם סיסמה מפוענחת DPAPI. `emailEnabled()` בודק enabled+cred.
- `--test` שולח מייל בדיקה. כבוי כברירת מחדל.

### `worklog-config.js` — מנוע הגדרות
- קורא/ממזג/כותב `config.json`. CLI: `email on/off`, `email.time`, `email.days` (תומך `Sun-Thu`),
  `weekly.day/time/off`. **כל שינוי קורא ל-`registerTasks` → רישום מחדש** (אין drift הגדרות↔תזמון).

### `worklog-schedule.js` — רישום משימות מ-config (משותף ל-install/config/email)
- `defaultConfig()`, `parseDays()`, `registerTasks(...)`, `describe()`.
- רישום = איפוס מלא (Unregister-all → register applicable), כולל ניקוי `WorkJournal-Daily` הישן.
- בונה: `WorkJournal-Notify` (18:00 א׳–ה׳, קבוע) · `WorkJournal-DailyEmail` + `WorkJournal-Weekly` (אם email.enabled).

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
