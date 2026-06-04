# מדריך — שליחה ובדיקה אצל חבר צוות (Windows)

מדריך תפעולי: מה לשלוח ואיך להדריך. גרסה נוכחית: **0.7.4**.

---

## חלק 1 — מה לשלוח
**קובץ אחד:**
```
C:\Users\sarit\youleap\someSkills\work-journal\dist\work-journal-setup.zip
```
(אם שינית קוד — הרץ `node build.js` לרענון.) בתוך ה-zip יש `INSTALL.md` עם כל ההוראות, כגיבוי.

> **עדכון גרסה:** שלח zip חדש; החבר מחלץ **מעל** `~/.claude/skills/work-journal-setup/` ומריץ שוב
> `/work-journal-setup`. אידמפוטנטי — יראה `updating from X`, לא משכפל, שומר hooks אחרים.

---

## חלק 2 — ההודעה לחבר הצוות (העתק־הדבק)
> היי! מצרף כלי שמתעד אוטומטית מה עבדת עליו ב-Claude Code ומפיק סיכום יומי/שבועי. הכול מקומי אצלך.
>
> **דרישה:** Node.js מותקן (`node --version`; אם אין — nodejs.org).
>
> **התקנה:**
> 1. חלץ את `work-journal-setup.zip` לתוך `%USERPROFILE%\.claude\skills\` (שייווצר `...\skills\work-journal-setup\`).
> 2. ב-Claude Code: `/work-journal-setup` → אשר.
> 3. **פתח סשן חדש** (חשוב — אז ה-hooks נטענים).
>
> מעכשיו: התראת סיכום ב-18:00; `/worklog show` ליומן · `/worklog status` תמונת-מצב · `/worklog summary` סיכום מיידי · `/worklog send` שליחה-עכשיו · `/worklog help` כל הפקודות.
> **רוצה גם מייל בסוף יום?** ספר לי ואדריך אותך בהפעלה (אופציונלי, כבוי כברירת מחדל).
> בעיות? דבר איתי.

---

## חלק 3 — איך לוודא שעבד (אצל החבר)
1. **hooks הותקנו:** `Get-ChildItem "$env:USERPROFILE\.claude\hooks\worklog-*.js"` → 12 קבצים.
2. **המשימה נרשמה:** `Get-ScheduledTask -TaskName "WorkJournal-*"` → לפחות `WorkJournal-Notify` (Ready).
   (אם הפעיל מייל — גם `WorkJournal-DailyEmail` ו-`WorkJournal-Weekly`.)
3. **בדיקה חיה:** ב**סשן חדש** → `/worklog "בדיקת התקנה"` → `/worklog show` → הרשומה מופיעה.
4. **סיכום + התראה:** `/worklog summary` → נוצר `summary-…md`, וב-18:00 תקפוץ התראה (לחיצה פותחת אותה).
5. **תמונת-מצב:** `/worklog status` → בלוק עם רשומות היום + יעדים (מייל/יומן) + שפת סיכום + תזמון.

---

## חלק 4 — הפעלת מייל (אם החבר רוצה)
1. App Password ב-Google: https://myaccount.google.com/apppasswords (דורש אימות דו-שלבי). שם `Work Journal` → Create → 16 תווים בלי רווחים.
   - *Workspace:* אם אין האופציה — האדמין חוסם; SMTP גנרי כחלופה.
2. ב-PowerShell/cmd (לא דרך Claude — הסיסמה מוסתרת):
   `node "%USERPROFILE%\.claude\hooks\worklog-email.js" --setup`
   רצף: כתובת → שולח (Enter=אותה) → host (Enter=smtp.gmail.com) → port (Enter=587) → App Password (מודבק מוסתר).
3. בדיקה: `node "%USERPROFILE%\.claude\hooks\worklog-email.js" --test` → מייל אמור להגיע.
ברירת מחדל: יומי 20:30 א׳–ה׳, שבועי ראשון 08:00. שינוי: בקש מ-Claude ("תשלח ב-21:00") או `worklog-config.js`.

---

## חלק 5 — פתרון תקלות
| תסמין | פתרון |
|-------|-------|
| `/work-journal-setup` לא מופיע | ה-zip לא במקום הנכון — ודא `~/.claude/skills/work-journal-setup/SKILL.md`, ופתח סשן חדש |
| `node is not recognized` | Node לא ב-PATH — התקן מ-nodejs.org, פתח טרמינל חדש |
| סיכום הוא רשימה ולא AI | `claude` CLI לא נמצא — fallback תקין בינתיים |
| תיעוד לא קורה אוטומטית | hooks נטענים רק בסשן **חדש** — לסגור ולפתוח את Claude Code |
| `--test` של מייל נכשל | בדוק App Password (בלי רווחים) + 2SV; ב-Workspace ייתכן חסימת אדמין |
| חשש לקונפיג קיים | ההתקנה מגבה ל-`settings.json.bak` ולא דורסת hooks אחרים |

---

## חלק 6 — אחרי הבדיקה
עבד חלק → אפשר להפיץ לשאר הצוות / להכניס לקטלוג. נתקע → אסוף את הודעת השגיאה + פלט חלק 3, ונתקן.
