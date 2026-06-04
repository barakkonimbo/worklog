# יומן התקדמות — Work Journal

> **משמעת עבודה:** בסוף כל סשן עבודה על המוצר הזה, מוסיפים כאן רשומה מתוארכת — מה נעשה, מה הוחלט,
> מה נשאר פתוח. זהו מקור-האמת ל"איפה אנחנו". רשומה אחרונה למעלה אחרי הראשונה (כרונולוגי יורד מתחת ל-Status).

---

## 📊 Status Board (מצב נוכחי)

| תחום | סטטוס |
|------|-------|
| ליבת תיעוד (hooks + log) | ✅ הושלם ונבדק |
| הזרקה לכל סשן (SessionStart) | ✅ הושלם ונבדק |
| רשת ביטחון (SessionEnd) | ✅ הושלם ונבדק |
| סיכום יומי/שבועי (AI) | ✅ הושלם ונבדק |
| התראות (Windows toast, לחיצה פותחת סיכום/תיקייה) | ✅ הושלם ונבדק |
| תזמון (Task Scheduler, מבוסס-config) | ✅ 18:00 התראה · 20:30 מייל · א׳ 08:00 שבועי |
| שליחת מייל (Gmail, opt-in, DPAPI) | ✅ הושלם ונבדק (מייל בדיקה הגיע) |
| הגדרות ניתנות-לשינוי (/worklog + config) | ✅ הושלם ונבדק (round-trip) |
| מקור קנוני + תיעוד בפרויקט | ✅ הושלם |
| Installer + הפצה (skill/zip, גרסאות) | ✅ הושלם ונבדק (אידמפוטנטי) |
| הופץ לגיטהאב (dev repo + קטלוג) | ✅ worklog + youleap-Implementers/Features |
| Google Calendar (opt-in, OAuth, DPAPI) | ✅ נבנה ואומת חי — setup/test/sync/idempotent (v0.7.0) |
| תמיכה ב-macOS/Linux (תזמון) | ⏳ לא התחיל |

---

## 🎯 הצעד הבא (Next Up)
1. **חבר צוות → גרסה 0.7.0** — לשלוח zip מעודכן, `/work-journal-setup`, ואופציונלית `--setup` למייל ו/או ליומן.
2. **Cross-platform** — תזמון `launchd`/`cron` ל-macOS/Linux (ההתראות כבר תומכות mac/linux).
3. **שעות בבחירה בהתקנה** — לשאול שעות ב-`--setup` (כרגע ברירת מחדל + שינוי קל אח״כ).
4. **Calendar — שיפורי E1/E3/E4** (עיגון-לרשומה, חפיפת חלונות, flush אחרי קריסה) לפי טבלת ה-Known Limitations.

---

## 💡 רעיונות לאפיון (אג׳נדה לצ'אט הבא)
1. **ממשק on-demand + פקודות נוחות** — כבר יש `/worklog` (log/show/summary/week) + `worklog-config.js`. **פער:** אין "שלח עכשיו למייל/יומן" (הדליברי נעול ל-20:30). לאפיין: `/worklog send` או `summary --deliver` (מייל+יומן on-demand) + אולי תפריט סטטוס/toggle מאוחד.
2. **בידוד פר-משתמש** — *מאומת/תשובה (לא משימה):* כל חבר צוות OAuth משלו → יומן "Work Journal" בחשבון שלו, data מקומי, מייל לכתובתו. אין shared state — לא רואים אחד את התיעוד של השני.
3. **פורמט מותאם-פלטפורמה** — להמיר את ה-Markdown הקנוני למבנה לפי היעד: מייל **HTML** (`<b>`/`<ul>`, `Send-MailMessage -BodyAsHtml`), תיאור אירוע יומן (HTML מוגבל), toast plain. **מבנה בלבד, לא תוכן.**

---

## 🗓️ לוג כרונולוגי

### 2026-06-04 — Google Calendar הושלם ואומת (v0.7.0)
**נעשה:**
- `worklog-calendar.js` — OAuth2 loopback + Calendar REST, token מוצפן **DPAPI** (`.calendar-cred`), `--setup`/`--test`/`--sync`/`--disable`. **אומת חי:** setup (consent בדפדפן ✓), test (יצירה+מחיקה בזמן ✓), sync (2 בלוקים + אירוע סיכום ✓), **אידמפוטנטיות** (`replaced 3`, בלי כפילויות ✓).
- בלוקים מ-`worklog-blocks.js` (מעוגני-סשנים); לכידת מרווחי-סשן ב-`worklog-session-end.js` (פיצול-חצות E6) + E5 ב-session-start (create-if-absent); חיווט **fail-safe** ב-`worklog-summary.js` (spawn נפרד בריצת 20:30). משימת 20:30 נרשמת אם email **או** calendar. `calendar on/off` ב-worklog-config.
- **אבטחה:** ה-`.env` עם ה-secret מאומת ב-`.gitignore` (מעולם לא נדחף). כתיבה רק ליומן ייעודי "Work Journal" + תיוג `worklog=<date>` — לא נוגעים באירועים אמיתיים.
- פרוס מקומית (11 hooks, v0.7.0). מודל חזק (Opus) לשלב נגיעה-בקוד לפי בקשת המשתמש.

**פתוח:** אישור ויזואלי של הבלוקים אצל המשתמש; ship לקטלוג (Features/work-journal-setup → 0.7.0); cross-platform.

### 2026-06-04 — Calendar: אפיון + ליבת בלוקים (לקראת v0.7)
**נעשה:**
- אפיון מלא ב-[CALENDAR-SPEC.md](./CALENDAR-SPEC.md): בלוקים **מעוגני-סשנים, גזומי-פערים** (משתמשים בזמני-הסשן האמיתיים מה-hooks), יומן ייעודי, OAuth per-user, + טבלת **8 מקרי-קצה (Known Limitations)** עם דיספוזיציה (now/later/inherent).
- נבנה `src/hooks/worklog-blocks.js` — חישוב בלוקים **טהור ודטרמיניסטי (0 טוקני AI)**. **9/9 בדיקות עברו** (סשנים נפרדים → לא בלוק-ענק; פער-פנימי מתפצל; ריבוי-פרויקטים; מיזוג צמודים; dedupe לפי sessionId).

**הבא:** לכידת מרווחי-סשן ב-SessionEnd + `worklog-calendar.js` (OAuth/REST) — ייבנו וייבדקו **כיחידה אחת** אחרי שהמשתמש יוצר OAuth client, ואז deploy יחיד (בכוונה לא נגענו ב-hooks החיים כדי לא לשבור).

### 2026-06-04 — הופץ לגיטהאב (2 ריפו)
**נעשה:**
- **ריפו פיתוח:** github.com/barakkonimbo/worklog — כל הפרויקט. `dist/`+`*.zip` ב-gitignore (מתחדש ב-`node build.js`). שדרוגים עתידיים כאן.
- **קטלוג:** github.com/barakkonimbo/youleap-Implementers — קטגוריה חדשה `Features/` + `Features/work-journal-setup/` (תיקיית ההתקנה, בלי zip) + `Features/README.md` + עדכון README הקטלוג.
- **זרימת re-ship:** מפתחים ב-worklog → `node build.js` → מעתיקים `dist/work-journal-setup/` ל-`Implementers/Features/` → commit+push לשניהם.

**פתוח:** Google Calendar (באפיון).

### 2026-06-04 — מייל + הגדרות + פיצול תזמון (v0.6)
**נעשה:**
- ההתראה הפכה ל**לחיצה** (protocol activation) — פותחת את הסיכום או את התיקייה. נבדק ואושר ע"י המשתמש.
- **מייל (Gmail/SMTP)** — `worklog-email.js`, opt-in דרך `--setup`, סיסמה מוצפנת DPAPI. מייל בדיקה הגיע בהצלחה.
- **פיצול תזמון:** 18:00 א׳–ה׳ התראה בלבד (קבוע) · 20:30 א׳–ה׳ מייל סופי · ראשון 08:00 שבועי. התיעוד ממשיך כל היום (18:00 = ביניים, 20:30 = סופי).
- **שכבת הגדרות:** `worklog-config.js` + `worklog-schedule.js` — מייל on/off, שעות, ימים; כל שינוי מעדכן אוטומטית את המשימות. נבדק round-trip (21:00→20:30).
- הסיכום השבועי שונה ל**סיכום השבוע שעבר + מה שנשאר פתוח**.
- VERSION 0.6.0, zip עודכן, INSTALL.md קיבל את הוראות המייל המדויקות (per-prompt).

**הוחלט (D11):** מודל א׳ (התראת ביניים + מייל סופי); מייל **opt-in** (כבוי כברירת מחדל) → ברירת-מחדל-או-שעות-אישיות; התראת 18:00 קבועה לכולם.

**פתוח:** חבר צוות לגרסה 0.6.0; Google Calendar; תזמון cross-platform.

### 2026-06-04 — התראות + בדיקת חבר צוות (v0.3)
**נעשה:**
- חבר צוות (Windows) התקין מה-zip תוך שניות — `/work-journal-setup` עבד; תיעוד וסיכום נבדקו ועובדים.
- זוהה פער: לא קפצה התראה — כי השליחה הוגדרה "קובץ בלבד" (לא תקלה — פיצ'ר שלא נבנה).
- נוסף `worklog-notify.js`: Windows toast **ללא תלות** (WinRT), fail-safe, כיבוי ב-`WORKLOG_NO_NOTIFY=1`.
  חובר ל-`worklog-summary.js` (יומי+שבועי) עם תצוגה מקדימה קצרה.
- **אומת:** הרצת המשימה המתוזמנת האמיתית (`Start-ScheduledTask`) → סיכום נוצר מחדש + התראה קפצה. ה-zip נארז מחדש.

**הוחלט:** D10 — toast מקומי ללא מודול חיצוני (חיכוך אפס בהפצה); אזהרת Focus Assist.

**פתוח:** חבר הצוות צריך את ה-zip המעודכן + הרצה חוזרת לקבלת התראות. בהמשך: מייל, Calendar, cross-platform.

### 2026-06-04 — Installer + תיעוד + הפצה (v0.2)
**נעשה:**
- הוקם מבנה פרויקט מתועד: `README.md`, `docs/` (SUMMARY, ARCHITECTURE, DECISIONS, PROGRESS, DISTRIBUTION),
  ו-`src/` כמקור-אמת קנוני (hooks + skill + templates).
- ה-skill וה-`CLAUDE.md` הומרו לתבניות עם `{{NODE}}/{{HOOKS_DIR}}/{{JOURNAL_DIR}}` (ניידוּת).
- נכתב `install/install.js` — installer נייד ואידמפוטנטי: מעתיק hooks, מתקין skill (עם החלפת נתיבים),
  ממזג בלוק ל-CLAUDE.md, ממזג hooks ל-settings.json (גיבוי + שימור GSD), רושם משימות Windows.
- נכתב `install/uninstall.js` (+`--purge`), ו-`install/SKILL.md` (skill ההתקנה `work-journal-setup`).
- נכתב `build.js` — אורז ל-`dist/work-journal-setup/` + `.zip`.
- **אומת:** הרצת installer (פעמיים) → settings.json תקין, GSD נשמר, אפס שכפול, בלוק CLAUDE.md יחיד,
  skill עם נתיבים אמיתיים, 2 משימות בלבד. ה-installer המצורף ב-zip מוצא `./src` נכון.

**הוחלט:** הפצה דרך setup-skill עצמאי (כי work-journal אינו skill טהור — דורש hooks/settings/tasks).

**פתוח להמשך:** מייל, Google Calendar, תזמון cross-platform, בדיקה במכונה נקייה (ראו "הצעד הבא").

### 2026-06-04 — הקמת המערכת (v0.1)
**נעשה:**
- אפיון מול המשתמש (4 החלטות: שליחה=קובץ, תיעוד=היברידי, מבנה=מאוחד-מתויג, תזמון=18:00/שישי).
- אומת חוזה ה-hooks וה-CLI מול מומחה Claude Code (SessionStart/SessionEnd, additionalContext≤10k,
  פורמט transcript, דגלי headless).
- נכתבו ונבדקו: `worklog-lib.js`, `worklog-log.js`, `worklog-session-start.js`,
  `worklog-session-end.js`, `worklog-summary.js`.
- שולב ב-`settings.json` (אדיטיבי), נוצר `CLAUDE.md` גלובלי, נוצר skill `/worklog`.
- נרשמו 2 משימות ב-Task Scheduler.
- 4 בדיקות ליבה + סיכום יומי + סיכום שבועי — כולן עברו (ראו [SUMMARY.md](./SUMMARY.md) §5).
- הוקם מבנה הפרויקט הזה: `src/` (מקור קנוני) + `docs/` (SUMMARY/ARCHITECTURE/DECISIONS/PROGRESS).

**הוחלט (ראו [DECISIONS.md](./DECISIONS.md)):** D1–D9. בלטו: לא `--bare` (auth) → `WORKLOG_DISABLE`;
תזמון מקומי ולא ענן; קלוד→stdout ו-node כותב.

**מלכודת שנפתרה:** `claude -p --bare` → "Not logged in". פתרון: הסרת `--bare` + recursion guard ב-env.

**פתוח להמשך:** Installer, הפצה, מייל, Calendar, cross-platform (ראו "הצעד הבא").
