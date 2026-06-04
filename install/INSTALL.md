# Work Journal — התקנה (יומן עבודה אוטומטי ל-Claude Code)

## מה זה?
מערכת שנטענת אוטומטית בכל סשן של Claude Code ומתעדת לאורך היום מה עבדת עליו (לפי פרויקט).
בסוף היום מתקבל סיכום AI ברמת-על. הכול נשמר **מקומית** אצלך, באף שרת.
- **18:00 (א׳–ה׳)** — התראה מקומית עם סיכום היום (קבוע לכולם).
- **מייל בסוף יום** — אופציונלי, כבוי כברירת מחדל. מי שמפעיל מקבל מייל סופי ב-**20:30 (א׳–ה׳)**
  וסיכום שבועי ב-**ראשון 08:00**.

## דרישות מקדימות
- **Claude Code** מותקן.
- **Node.js** ב-PATH. בדיקה: `node --version` (אם אין — התקן מ-https://nodejs.org).
- (לסיכומי AI) `claude --version` זמין. אם חסר — ההתקנה עובדת, אבל הסיכום יהיה רשימה לפי פרויקט במקום AI.

## התקנה (Windows) — בחר דרך אחת
### דרך א׳ — דרך Claude Code (הכי קל)
1. חלץ את `work-journal-setup.zip` לתוך `%USERPROFILE%\.claude\skills\`
   (שייווצר `%USERPROFILE%\.claude\skills\work-journal-setup\`).
2. ב-Claude Code הרץ: `/work-journal-setup`
3. אשר. **מהסשן הבא** הכול פעיל.

### דרך ב׳ — מהטרמינל
1. חלץ את ה-zip לכל מקום.
2. בתיקייה `work-journal-setup` הרץ: `node install.js`

## מה ההתקנה עושה (שקיפות)
- מוסיפה hooks ל-`~/.claude/hooks/` ואת ה-skill `/worklog`.
- ממזגת בלוק ל-`~/.claude/CLAUDE.md` ורשומות hooks ל-`~/.claude/settings.json` (**מגבה ל-`.bak`, לא דורסת קיים**).
- רושמת משימה מתוזמנת אחת להתראת 18:00 (ועוד משימות מייל רק אם תפעיל מייל).
- **אידמפוטנטית** — בטוח להריץ שוב (גם לעדכון גרסה).

## שימוש אחרי ההתקנה
- **אוטומטי:** נטען בכל סשן; קלוד מתעד בנקודות מפתח; התראת 18:00.
- **ידני:** `/worklog <טקסט>` לרשום · `/worklog show` · `/worklog status` · `/worklog summary` · `/worklog send` (שלח עכשיו) · `/worklog help` (כל הפקודות).

## מייל בסוף יום (אופציונלי — כבוי כברירת מחדל)
מי שרוצה מייל מפעיל פעם אחת:
1. **App Password ב-Google:** https://myaccount.google.com/apppasswords (דורש אימות דו-שלבי).
   שם: `Work Journal` → Create → העתק 16 תווים **בלי רווחים**.
   - *Google Workspace:* אם אין "App passwords" — האדמין חוסם; דברו איתו או השתמשו ב-SMTP גנרי.
2. **הפעלה** (ב-PowerShell/cmd — **לא** דרך Claude, כי הסיסמה מוסתרת):
   `node "%USERPROFILE%\.claude\hooks\worklog-email.js" --setup`
   רצף השאלות: כתובת קבלה → כתובת שולח (Enter=אותה) → SMTP host (Enter=`smtp.gmail.com`) →
   port (Enter=`587`) → **App Password** (הדבק; לא יוצג על המסך — תקין).
3. **בדיקה:** `node "%USERPROFILE%\.claude\hooks\worklog-email.js" --test` → אמור להגיע מייל.

ברירות מחדל אחרי הפעלה: יומי **20:30 א׳–ה׳**, שבועי **ראשון 08:00**. הסיסמה נשמרת **מוצפנת (DPAPI)**.

## Google Calendar בסוף יום (אופציונלי — כבוי כברירת מחדל)
מסנכרן בסוף היום בלוקי-זמן לפי פרויקט + אירוע "סיכום יום" ל**יומן ייעודי "Work Journal"** (לא נוגע באירועים אמיתיים). דורש סטאפ OAuth חד-פעמי:
1. **OAuth client ב-Google Cloud** (פעם אחת): https://console.cloud.google.com → New Project `Work Journal` → הפעל **Google Calendar API** → **OAuth consent screen** = **Internal** (Workspace) → **Credentials → OAuth client ID → Desktop app** → העתק **Client ID** + **Client secret**.
   - ⚠️ אל תתחיל את ה-$300 trial (לא נדרש). אם רק "External" זמין — refresh token פג אחרי 7 ימים; עדיף Internal.
2. **הפעלה** (ב-PowerShell/cmd): `node "%USERPROFILE%\.claude\hooks\worklog-calendar.js" --setup`
   הדבק Client ID + Secret → ייפתח דפדפן לאישור → אשר. (ה-token נשמר **מוצפן DPAPI**.)
3. **בדיקה:** `node "%USERPROFILE%\.claude\hooks\worklog-calendar.js" --test` → אירוע בדיקה נוצר ונמחק ביומן "Work Journal".

הסנכרון רץ אוטומטית בריצת הסוף-יום (20:30). כיבוי: `worklog-config.js calendar off`.

## שינוי הגדרות (קל)
**דרך Claude** — פשוט בקש: "כבה לי את מייל היומן" · "תשלח את המייל ב-21:00" · "שבועי ביום חמישי".
**או ישירות** (כל שינוי מעדכן אוטומטית את המשימות):
- הצגה: `node "%USERPROFILE%\.claude\hooks\worklog-config.js"`
- מייל off/on: `… worklog-config.js email off` · `email on`
- יומן off/on: `… worklog-config.js calendar off` · `calendar on`
- שעה/ימים: `… worklog-config.js email.time 21:00` · `email.days Sun-Thu`
- שבועי: `… worklog-config.js weekly.day Sunday` · `weekly.time 08:00` · `weekly off`
- שפת הסיכום: `… worklog-config.js language English` (חופשי; ברירת מחדל עברית)
- תמונת-מצב מאוחדת: `… worklog-config.js status`

## הסרה
- `node uninstall.js` — מסיר את המערכת, שומר את הלוגים.
- `node uninstall.js --purge` — מסיר גם את הלוגים.
