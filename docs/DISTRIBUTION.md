# הפצה — Work Journal

איך אורזים את המוצר ומעבירים אותו לחברי הצוות.

---

## בנייה (אצלנו)

```bash
node build.js
```
מייצר:
- `dist/work-journal-setup/` — תיקיית skill עצמאית (SKILL.md + install.js + uninstall.js + src/)
- `dist/work-journal-setup.zip` — מכווץ לשיתוף (כמו `git-dev-push.zip`)

`build.js` בונה תמיד מחדש מהמקור הקנוני ב-`src/`. אם שינית משהו ב-`src/` — הרץ build מחדש.

---

## איך חבר צוות מתקין (שתי דרכים)

**דרישת קדם:** Node.js ב-PATH (`node --version`). (ל-Windows גם תזמון אוטומטי; ב-mac/Linux הסיכומים ידניים בינתיים.)

### דרך א׳ — כ-skill (מומלץ, תואם לקטלוג)
1. לפרוס את `work-journal-setup/` לתוך `~/.claude/skills/`.
2. להריץ פעם אחת: `/work-journal-setup`.
3. זהו — מהסשן הבא הכול אוטומטי.

### דרך ב׳ — מהטרמינל
```bash
# פורסים לכל מקום, ואז:
node work-journal-setup/install.js
```

שתי הדרכים מריצות את אותו `install.js` (אידמפוטנטי, מגבה את settings.json, מחליף נתיבים מקומית).

---

## עדכון גרסה
משתפים zip חדש, החבר פורס מעליו ומריץ שוב את ההתקנה. ההתקנה **אידמפוטנטית** — מחליפה את החלקים שלנו
בלי לשכפל, ושומרת hooks אחרים (GSD וכו').

## הסרה
```bash
node work-journal-setup/uninstall.js            # משאיר את נתוני היומן
node work-journal-setup/uninstall.js --purge    # מוחק גם את הלוגים
```

---

## מה ההתקנה נוגעת בו (שקיפות לחבר הצוות)
- מוסיפה קבצים תחת `~/.claude/hooks/`, `~/.claude/skills/worklog/`.
- ממזגת בלוק מסומן ל-`~/.claude/CLAUDE.md` (בין `WORK-JOURNAL:START/END`).
- ממזגת רשומות `SessionStart`+`SessionEnd` ל-`~/.claude/settings.json` (מגבה ל-`.bak`, לא דורסת hooks קיימים).
- רושמת ב-Task Scheduler (Windows): `WorkJournal-Notify` (18:00 א׳–ה׳, התראה). אם מופעל מייל **או** יומן — גם
  `WorkJournal-DailyEmail` (20:30 א׳–ה׳); אם מייל — גם `WorkJournal-Weekly` (ראשון 08:00).
- מייל הוא **opt-in** (כבוי כברירת מחדל); הפעלה דרך `worklog-email.js --setup`, סיסמה מוצפנת DPAPI.
- **Google Calendar** הוא **opt-in** (כבוי כברירת מחדל); הפעלה דרך `worklog-calendar.js --setup` (OAuth, token מוצפן DPAPI). כותב רק ליומן ייעודי "Work Journal".
- יוצרת `~/.claude/work-journal/` לנתונים (`config.json`, `.sessions/`, סיכומים; ה-creds מוצפנים DPAPI).

## מגבלות ידועות (להפצה רחבה)
- **תזמון אוטומטי = Windows בלבד** כרגע. mac/Linux → צריך `launchd`/`cron` (ב-roadmap).
- **`claude` CLI** צריך להיות זמין למכונה (PATH) לסיכומי AI; אחרת נופלים ל-fallback מקבץ-לפי-פרויקט.
- **Auth** — הסיכום המתוזמן משתמש ב-login השמור; מכונה ללא login אינטראקטיבי תצטרך `ANTHROPIC_API_KEY`.

## ריפוזיטוריז (איפה זה חי)
- **פיתוח:** `github.com/barakkonimbo/worklog` — כל הפרויקט הזה. כאן עושים שדרוגים / commits / שחזור. `dist/`+`*.zip` ב-gitignore (מתחדש ב-`node build.js`).
- **קטלוג (הפצה):** `github.com/barakkonimbo/youleap-Implementers` בנתיב `Features/work-journal-setup/` — תיקיית ההתקנה (בלי zip), מוכנה להרצה ע"י כל חבר צוות.

**re-ship אחרי שינוי:** `node build.js` → להעתיק `dist/work-journal-setup/` אל
`youleap-Implementers/Features/work-journal-setup/` → לעדכן "Current contents" ב-README הקטלוג → commit+push לשני הריפו.
