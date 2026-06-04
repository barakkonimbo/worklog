# אפיון — אינטגרציית Google Calendar (Work Journal)

> סטטוס: **נבנה ואומת חי** (v0.7.0, 2026-06-04) — `--setup` / `--test` / `--sync` / אידמפוטנטיות ✅.
> מטרה: להוסיף אוטומטית ליומן Google תיעוד חזותי של מה עבדנו עליו — **בלי לגעת באירועים אמיתיים**.

## מימוש (v0.7.0)
- `src/hooks/worklog-calendar.js` — OAuth2 loopback (`--setup --env <path>` / prompt), Calendar REST, `--test`, `--sync [date]`. Token (`{client_id,client_secret,refresh_token}`) נשמר **מוצפן DPAPI** ב-`.calendar-cred`; access token מתחדש בכל ריצה.
- `src/hooks/worklog-blocks.js` — חישוב הבלוקים (טהור, נבדק 9/9).
- **טריגר:** `worklog-summary.js` מריץ `worklog-calendar.js --sync` בריצת הסוף-יום (`--email`, 20:30) — כ-**spawn נפרד ובטוח-כשל** (כשל ביומן לא שובר סיכום/מייל/התראה). משימת ה-20:30 נרשמת אם `email.enabled` **או** `calendar.enabled`.
- **לכידת סשנים:** `worklog-session-end.js` כותב `{start,end,project,sessionId}` ל-`.sessions/<date>.jsonl` (פיצול-חצות); `worklog-session-start.js` יוצר marker רק-אם-חסר (E5).
- **בטיחות:** כותב רק ליומן "Work Journal" הייעודי, ומוחק/יוצר רק אירועים מתויגים `worklog=<date>`.

---

## החלטות (מאופיין מול המשתמש 2026-06-04)

| נושא | החלטה | הנמקה |
|------|-------|-------|
| תוכן | **בלוקים לפי פרויקט** (דטרמיניסטי מהלוג) + **אירוע "סיכום יום"** (תיאור = סיכום ה-AI הקיים) | בלוקים = "מה מתי"; הסיכום = הנרטיב. שניהם **ללא טוקנים נוספים** |
| תזמון | **סוף יום** — יחד עם ריצת ה-20:30 (`--email`). regenerate-and-replace | סיכום סופי; אידמפוטנטי. (בזמן-אמת — עתידי) |
| יומן יעד | **יומן ייעודי "Work Journal"** (נוצר אוטומטית אם חסר) | הפרדה מוחלטת מהיומן הראשי |
| בטיחות | כותבים **רק** ליומן הייעודי + תיוג `worklog=<date>` על כל אירוע; נוגעים אך ורק באירועים שלנו | מבטיח "לא דורסים אירועים קיימים" |
| אימות | **OAuth2 חד-פעמי, client לכל משתמש** (כל אחד יוצר OAuth client משלו), refresh token מוצפן DPAPI | אוטומטי לאחר סטאפ, ללא תלות משותפת |
| תלויות | ללא npm — REST דרך `https`/PowerShell + Bearer token | עקבי עם שאר המוצר |

---

## מודל האירועים (ביומן הייעודי בלבד)
1. **בלוקי פרויקט (timed):** ריצה רציפה של אותו פרויקט = בלוק. כותרת `[<project>] <תקציר>`, תיאור = הרשומות שבבלוק.
2. **סיכום יום (all-day):** כותרת `📓 סיכום היום`, תיאור = תוכן `summary-YYYY-MM-DD.md` (כבר קיים — אפס טוקנים).
3. כל אירוע מתויג `extendedProperties.private.worklog = <YYYY-MM-DD>` (מזהה שלנו).

## אלגוריתם הבלוקים — מעוגן-סשנים, גזום-פערים (node, 0 טוקני AI)
**התובנה:** ה-hooks כבר יודעים את **זמני הסשן האמיתיים** (`SessionStart` שומר `startTime`; `SessionEnd` יודע `end`) — כרגע נזרק. נשתמש בו כעוגן אמיתי במקום לנחש מ-milestones.
פרמטרים: `MAX_GAP=90 ד'`, `MIN_BLOCK=15 ד'` — ניתנים-להגדרה.

**לכידה (חדש, זול — רק חותמות זמן, 0 AI):** ב-`SessionEnd`, לפני מחיקת ה-marker, נוסיף רשומה ל-`sessions-YYYY-MM-DD.jsonl`: `{start, end, project, sessionId}`.

**חישוב (סוף יום, דטרמיניסטי):**
1. טען את סשני היום (מרווחים אמיתיים `[start,end]`) + רשומות הלוג (חותמות + תג פרויקט).
2. לכל סשן: קח רשומות שבתוך `[start,end]`, פצל ל-**streaks** לפי פרויקט (פער ≤ `MAX_GAP`).
3. בלוק לכל streak, **חתוך למרווח הסשן**:
   - streak ראשון בסשן מתחיל ב-**`session.start`** (אמיתי); האחרון מסתיים ב-**`session.end`** (אלא אם הפער מהרשומה האחרונה ל-end > `MAX_GAP` → נגזם).
   - פער > `MAX_GAP` בתוך הסשן → פיצול; החלק הסרק נשאר **ריק**.
4. סשן בלי רשומות → ברירת מחדל **דילוג** (לא טוענים זמן לא-מתועד). ניתן-להגדרה.
5. בלוקים צמודים, אותו פרויקט, פער ≤ `MAX_GAP` (גם בין סשנים) → מיזוג.

**למה עדיף וזול:** גבולות = זמני סשן **אמיתיים** (לא ניחוש MIN_BLOCK); ריבוי סשנים → פערים אמיתיים; סרק בתוך סשן ארוך → נגזם. עלות: 0 טוקני AI, רק כתיבת חותמות ב-hook.
**מגבלה מובנית:** נלכדת רק עבודת Claude-session (עבודה מחוץ ל-Claude לא מתועדת ביומן ממילא). פולבק: אם אין קובץ סשנים (גרסה ישנה) — חזרה לבלוקים מ-milestones בלבד.

## בטיחות ואידמפוטנטיות (קריטי — דרישת המשתמש)
- כתיבה **אך ורק** ליומן "Work Journal" הייעודי. **לעולם** לא ליומן הראשי / אירועים אחרים.
- לפני סנכרון היום: מוחקים רק אירועים שמתויגים `worklog=<today>` (לא נוגעים באירועים אחרים — גם לא כאלה שהמשתמש הוסיף ידנית ליומן הייעודי).
- ואז יוצרים מחדש מהלוג הסופי. → regenerate-and-replace בטוח לחלוטין.

## אימות (OAuth2)
- **סטאפ חד-פעמי** (`worklog-calendar.js --setup`): OAuth client (Desktop) → consent בדפדפן → refresh token.
- refresh token נשמר **מוצפן DPAPI** (כמו סיסמת המייל). access token מתחדש בכל ריצה (REST).
- scope: `https://www.googleapis.com/auth/calendar`.

### מדריך סטאפ ידני — יצירת OAuth client (פעם אחת, לכל משתמש)
0. **אל תתחיל את ה-$300 trial** ("Try for free"/"Start free") — לא נדרש, לא צריך כרטיס אשראי.
1. https://console.cloud.google.com → **Select a project → New Project** (שם `Work Journal`) → Create.
2. חיפוש `Google Calendar API` → **Enable** (חינם, ללא billing).
3. **OAuth consent screen / Google Auth Platform:** בחר **Internal** אם זמין (Workspace) — **אין אימות, refresh token לא פג**. שם `Work Journal`, support+developer email = שלך.
   ⚠️ **אם רק External זמין** (חשבון אישי) — האפליקציה במצב "testing" וה-**refresh token פג אחרי 7 ימים** → לא מתאים לאוטומציה יומית. במקרה כזה: לעצור ולתכנן (publish/verification או חלופה).
4. **Credentials → Create credentials → OAuth client ID → Application type = `Desktop app`** → `Work Journal` → Create.
5. העתק **Client ID** + **Client secret** (אל תשתף — יודבקו מקומית ב-`worklog-calendar.js --setup`, יישמרו מוצפנים DPAPI).
ה-`--setup` ירים שרת מקומי זמני (`http://localhost`) שיתפוס את ה-consent (סטנדרטי ל-Desktop client).

## רכיבים לבנייה
- `src/hooks/worklog-calendar.js` — `--setup` (OAuth), `--test`, `syncDay(date)`; נקרא מ-`worklog-summary.js` אחרי הסיכום (אם `calendar.enabled`).
- **הרחבת `worklog-session-end.js`** — לכידת מרווח הסשן ל-`sessions-<date>.jsonl` (הבסיס לבלוקים המדויקים).
- הרחבת `config.json`: `calendar: { enabled, calendarId, summaryEvent, minBlockMinutes:15, maxGapMinutes:90 }`.
- הרחבת `worklog-config.js`: `calendar on/off` (+ אפשרויות).
- הרחבת `INSTALL.md` / setup-skill: opt-in להפעלת calendar (כמו המייל).

## הוכרע (2026-06-04)
1. **OAuth client:** לכל משתמש client משלו (ללא תלות משותפת). אם konimbo = Workspace → אפשר "Internal" (בלי אימות-אפליקציה, refresh token לא פג).
2. **בלוקים:** `MIN_BLOCK=15 ד'`, `MAX_GAP=90 ד'` (אלגוריתם מודע-לפערים למעלה). ניתנים-להגדרה.
3. **תוכן:** בלוקים **+** אירוע "סיכום יום" all-day (כל אחד ניתן לכיבוי).

## מקרי קצה ידועים (Known Limitations) — תיעוד מלא
> נאסף 2026-06-04. סטטוס: **now**=מטופל בבנייה · **later**=אולי בעתיד · **inherent**=מובנה, מקבלים · **never**=לא נטפל.

| # | מקרה | התנהגות | סטטוס |
|---|------|---------|-------|
| E0 | עבודה מחוץ ל-Claude | לא מתועדת ביומן | **inherent** (היומן = עבודת-Claude) |
| E1 | סשן פתוח ≠ עובד (סרק בקצוות) | over-claim קל בתחילת/סוף סשן | **later** (לעגן-לרשומה אם רחוק מהקצה); gap-trim כבר מטפל בסרק-פנימי |
| E2 | החלפת פרויקט לא-מתועדת בתוך סשן | מיוחס לפרויקט המתועד | **inherent** (תלוי משמעת-תיעוד) |
| E3 | שני חלונות Claude במקביל | בלוקים חופפים ביומן | **later** (זיהוי/מיזוג חפיפה); כרגע מציגים חופף |
| E4 | קריסה/כיבוי בלי SessionEnd | מרווח הסשן לא נרשם → נופלים ל-milestones | **later** (flush של marker תלוי בתחילת הסשן הבא) |
| E5 | compact/resume מפעילים SessionStart מחדש | פיצול/איפוס start | **now** (marker create-if-absent + רישום לפי sessionId) |
| E6 | סשן חוצה-חצות | שיוך-יום מעורפל | **now** (פיצול ב-00:00 בזמן הלכידה) |
| E7 | סשן מהותי בלי תיעוד כלל | מושמט (אין בלוק) | **inherent-בכוונה** (תת-דיווח); רשת-הביטחון של SessionEnd ממתנת |

**עיקרון-על:** בספק → **תת-דיווח, לא over-claim**. אירוע "סיכום היום" = מקור-האמת לנרטיב; הבלוקים = קירוב חזותי.

## לא בסקופ (עתידי)
- עדכון בזמן-אמת (קודם סוף-יום).
- cross-platform (OAuth זהה; התזמון תלוי-OS כמו היום).
