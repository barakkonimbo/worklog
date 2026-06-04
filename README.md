# Work Journal — יומן עבודה אוטומטי ל-Claude Code

מערכת שנטענת אוטומטית **בכל סשן Claude Code, בכל פרויקט**, מתעדת לאורך היום מה עבדת עליו (לפי
פרויקט), ומפיקה **סיכום AI** — יומי ושבועי. עם **התראה לחיצה** בסוף היום ו**מייל אופציונלי**.
הכול נשמר **מקומית** אצלך, באף שרת.

`גרסה 0.6.0` · `Windows (mac/Linux חלקי)` · `ללא תלות חיצונית (Node + Claude CLI)`

---

## מה זה נותן

- **תיעוד אוטומטי** — קלוד מתעד שורה קצרה בנקודות מפתח (סיום משימה, PR, החלטה), עם תג `[פרויקט]`.
  רשת ביטחון מבטיחה שאף סשן לא נשאר בלי תיעוד.
- **המשכיות בין סשנים** — כל סשן חדש "רואה" את יומן היום ואתמול (מוזרק אוטומטית).
- **18:00 (א׳–ה׳)** — התראת ביניים עם סיכום היום. **לחיצה פותחת את הסיכום** (או את התיקייה). קבוע לכולם.
- **מייל סופי (opt-in)** — מי שמפעיל מקבל ב-**20:30 (א׳–ה׳)** מייל עם סיכום *סופי* של היום (כולל עבודה אחרי 18:00).
- **שבועי** — **ראשון 08:00** מייל עם סיכום **השבוע שעבר** + מה שנשאר פתוח.
- **סיכום חכם, לא חותמות** — ה-AI שוזר את הרשומות לנרטיב לפי פרויקט + ציר זמן + בולטים.
- **ניתן להפצה** — installer אידמפוטנטי שחבר צוות מריץ ומקבל את המוצר המלא.

---

## התקנה מהירה (Windows)

1. חלץ את `dist/work-journal-setup.zip` לתוך `%USERPROFILE%\.claude\skills\`.
2. ב-Claude Code: `/work-journal-setup`.
3. מהסשן הבא — פעיל. (דרישה: Node.js ב-PATH.)

מדריך מלא לחבר צוות: [docs/SEND-TO-TEAMMATE.md](./docs/SEND-TO-TEAMMATE.md) · הוראות מותקנות: [install/INSTALL.md](./install/INSTALL.md).

---

## שימוש

**אוטומטי** — נטען בכל סשן; תיעוד בנקודות מפתח; התראת 18:00; מייל 20:30 אם הופעל.

**ידני / שליטה דרך `/worklog`:**
- `/worklog <טקסט>` — רשומה ידנית
- `/worklog show` — הצגת יומן היום
- `/worklog summary` · `/worklog week` — סיכום מיידי
- הגדרות בשפה חופשית — "כבה מייל", "תשלח ב-21:00", "שבועי ביום חמישי"

**מייל (אופציונלי, כבוי כברירת מחדל):**
```
node "%USERPROFILE%\.claude\hooks\worklog-email.js" --setup   # פעם אחת (App Password, מוצפן DPAPI)
node "%USERPROFILE%\.claude\hooks\worklog-email.js" --test    # בדיקה
```
**שינוי הגדרות (מעדכן אוטומטית את המשימות):**
```
node "%USERPROFILE%\.claude\hooks\worklog-config.js"                 # הצגה
node "%USERPROFILE%\.claude\hooks\worklog-config.js" email off|on
node "%USERPROFILE%\.claude\hooks\worklog-config.js" email.time 21:00
node "%USERPROFILE%\.claude\hooks\worklog-config.js" email.days Sun-Thu
node "%USERPROFILE%\.claude\hooks\worklog-config.js" weekly.day Sunday weekly.time 08:00
```

---

## תזמון (ברירת מחדל)

| משימה | מתי | פעולה |
|------|-----|-------|
| `WorkJournal-Notify` | 18:00, א׳–ה׳ | התראת ביניים (ללא מייל) — **קבוע לכולם** |
| `WorkJournal-DailyEmail` | 20:30, א׳–ה׳ | מייל סיכום סופי — רק אם מייל מופעל |
| `WorkJournal-Weekly` | ראשון 08:00 | מייל סיכום השבוע שעבר — רק אם מייל מופעל |

מודל שני-שלבי: קודם בוחרים אם מייל פעיל בכלל (ברירת מחדל כבוי); אם כן — ברירת מחדל **או** שעות/ימים אישיים.

---

## מבנה הפרויקט

```
work-journal/
├── README.md              ← המסמך הזה (חזית)
├── VERSION                ← גרסת המוצר
├── build.js               ← אורז את dist/work-journal-setup(.zip)
├── docs/
│   ├── SUMMARY.md         ← סיכום מלא: מה בנינו ולמה  ← התחל כאן
│   ├── ARCHITECTURE.md    ← איך זה עובד (טכני, קובץ-קובץ)
│   ├── DECISIONS.md       ← החלטות תכנון D1–D11 + מלכודות
│   ├── PROGRESS.md        ← יומן התקדמות חי (מתעדכן כל סשן)
│   ├── DISTRIBUTION.md    ← איך אורזים ומפיצים
│   └── SEND-TO-TEAMMATE.md← מדריך תפעולי לשליחה ובדיקה אצל חבר צוות
├── install/
│   ├── SKILL.md           ← skill ההתקנה (work-journal-setup)
│   ├── INSTALL.md         ← הוראות התקנה+מייל לחבר הצוות (נכנס ל-zip)
│   ├── install.js         ← installer נייד ואידמפוטנטי
│   └── uninstall.js       ← הסרה (+--purge)
├── src/                   ← מקור קנוני (נפרס ל-~/.claude/)
│   ├── hooks/             ← lib · log · session-start · session-end · summary · notify · email · config · schedule
│   ├── skill/SKILL.tpl.md ← skill /worklog (תבנית; install מחליף נתיבים)
│   └── templates/         ← בלוק CLAUDE.md + רשומות hooks ל-settings.json
└── dist/                  ← תוצר build: work-journal-setup/ + .zip (להפצה)
```

---

## איך זה עובד (בקצרה)

- **תיעוד** מבוסס hooks: `SessionStart` מזריק את היומן + הוראת תיעוד; `SessionEnd` הוא רשת ביטחון.
- **סיכום** דרך `claude -p` (headless, `WORKLOG_DISABLE=1` למניעת רקורסיה); **node כותב את הקובץ**,
  ואם קלוד לא זמין יש fallback מקבץ-לפי-פרויקט.
- **תזמון** דרך Windows Task Scheduler, מבוסס `config.json` (worklog-schedule.js).
- **מייל** דרך SMTP (PowerShell), סיסמה מוצפנת DPAPI. **התראות** דרך WinRT toast, ללא מודול.

פירוט מלא → [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). הנמקות → [docs/DECISIONS.md](./docs/DECISIONS.md).

---

## הפצה

`node build.js` → `dist/work-journal-setup/` + `dist/work-journal-setup.zip`. חבר צוות פורס ל-skills
ומריץ `/work-journal-setup` (אידמפוטנטי, מציג `updating from X` בעדכון). פרטים → [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md).

---

## Roadmap

- **Google Calendar** בסוף יום (ואולי בזמן אמת).
- **תזמון cross-platform** — `launchd` (macOS) / `cron` (Linux). *(התראות כבר תומכות mac/Linux.)*
- בחירת שעות בזמן ההתקנה עצמה.

מצב מלא והתקדמות → [docs/PROGRESS.md](./docs/PROGRESS.md).
