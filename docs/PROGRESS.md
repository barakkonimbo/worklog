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
| תזמון (Task Scheduler, מבוסס-config) | ✅ 18:00 התראה · 20:30 מייל · א׳ 08:00 שבועי · **מחוסן: סוללה/wake/3×retry (v0.8.3)** |
| עמידוּת — ריפוי-עצמי ב-SessionStart | ✅ נבנה ונבדק (v0.8.3) — `worklog-backfill.js` ברקע משלים יום שתועד אך לא קיבל סיכום (מכונה כבויה/ישנה בשעת הריצה) |
| שליחת מייל (Gmail, opt-in, DPAPI, **HTML**) | ✅ הושלם ונבדק; מייל HTML אומת ויזואלית (v0.7.4) |
| הגדרות ניתנות-לשינוי (/worklog + config) | ✅ הושלם ונבדק (round-trip) |
| מקור קנוני + תיעוד בפרויקט | ✅ הושלם |
| Installer + הפצה (skill/zip, גרסאות) | ✅ הושלם ונבדק (אידמפוטנטי) |
| הופץ לגיטהאב (dev repo + קטלוג) | ✅ worklog + youleap-Implementers/Features |
| Google Calendar (opt-in, OAuth, DPAPI) | ✅ נבנה ואומת (v0.7.0); mirror מתמשך (v0.7.3); **fallback-רשומות + תיאור HTML** (v0.7.4); **בלוקים מבוססי-פעילות** (v0.7.6) |
| ממשק on-demand (`send`/`status`/`help`/שפת-פלט) | ✅ נבנה ואומת — 18/18 בדיקות מבודדות (v0.7.2) |
| שכבת פעילות (UserPromptSubmit → בלוקים מדויקים) | ✅ נבנה ואומת (v0.7.6) — חותמות זמן+פרויקט, פיצול 30ד׳ / זנב 10ד׳; **קיבוץ פר-פרויקט סובלני-להשתלבות (v0.8.1)** |
| Catch-up מייל + דילוג-סיכום | ✅ נבנה ואומת (v0.7.6) — מייל שפוספס נשלח למחרת ליום הנכון; אין סיכום-מחדש ללא שינוי |
| עדכון מקומי (`/worklog update`) | ✅ נבנה ואומת (v0.8.0) — זיהוי לפי content-manifest (לא רק גרסה), הסבר מ-`upgrade-notes.json`, סימון פעולות; creds לא נוגעים |
| Dispatcher לטרמינל (`worklog.js`) | ✅ נבנה ואומת (v0.8.0) — פקודה אחת לכל הפעלים; `help` מציג מיפוי צ'אט↔טרמינל |
| הקשחת פרסר-רשומות (סובלני ל-reformat) | ✅ נבנה ואומת (v0.8.0) — matcher משותף `[-*]`+`\\[` ב-5 אתרים; מונע ספירה-0 / דילוג-יום אחרי format-on-save |
| מירור היום ליומן המשתמש (push/unpush + autoPush) | ✅ נבנה ואומת (v0.8.2) — מירור מלא ליעד (primary כברירת מחדל), opt-in auto בסוף-יום; לא מחליף את Work Journal |
| תמיכה ב-macOS/Linux (תזמון) | ⏳ לא התחיל |

---

## 🎯 הצעד הבא (Next Up)
1. **חבר צוות → גרסה 0.7.3** — לשלוח zip מעודכן, `/work-journal-setup`, ואופציונלית `--setup` למייל ו/או ליומן. כולל `send`/`status`/`help`/בחירת שפה + יומן mirror מתמשך.
2. **Cross-platform** — תזמון `launchd`/`cron` ל-macOS/Linux (ההתראות כבר תומכות mac/linux).
3. **שעות בבחירה בהתקנה** — לשאול שעות ב-`--setup` (כרגע ברירת מחדל + שינוי קל אח״כ).
4. **Calendar — שיפורי E1/E3** (עיגון-לרשומה, חפיפת חלונות) לפי טבלת ה-Known Limitations. (E4 כבר ממותן ב-v0.7.3 — sync בכל SessionEnd.)

---

## 💡 רעיונות לאפיון (אג׳נדה לצ'אט הבא)
1. ✅ **ממשק on-demand — נבנה ואומת** (v0.7.1, [ONDEMAND-SPEC.md](./ONDEMAND-SPEC.md)): `worklog send` (regenerate→שלח לכל מופעל; גם `send email`/`calendar`) + `worklog status` (תצוגת-על) + בחירת **שפת סיכום** (`language`). 18/18 בדיקות מבודדות.
2. **בידוד פר-משתמש** — *מאומת/תשובה (לא משימה):* כל חבר צוות OAuth משלו → יומן "Work Journal" בחשבון שלו, data מקומי, מייל לכתובתו. אין shared state — לא רואים אחד את התיעוד של השני.
3. **פורמט מותאם-פלטפורמה** — להמיר את ה-Markdown הקנוני למבנה לפי היעד: מייל **HTML** (`<b>`/`<ul>`, `Send-MailMessage -BodyAsHtml`), תיאור אירוע יומן (HTML מוגבל), toast plain. **מבנה בלבד, לא תוכן.**

---

## 🗓️ לוג כרונולוגי

### 2026-06-10 — עמידוּת: חיסון המשימות + ריפוי-עצמי ב-SessionStart (v0.8.3)
**מה הניע:** המשתמש שם לב שלסיכום של 2026-06-09 לא נוצר קובץ, לא נשלח מייל, ולא סונכרן ביומן — אף שהיו רשומות. **אבחון:** `WorkJournal-DailyEmail` כן רצה (18:14, התעוררה באיחור) אך הסתיימה ב-`0x8007042B` (`ERROR_PROCESS_ABORTED`) — נהרגה באמצע יצירת הסיכום. **שורש:** ברירות-המחדל של `New-ScheduledTaskSettingsSet` — `StopIfGoingOnBatteries`+`DisallowStartIfOnBatteries` (סוללה הורגת/חוסמת) ו-`RestartCount=0` (אין retry). הסיכום הוא השלב הראשון → נהרג → הכל נפל.
**נעשה (שתי שכבות):**
- **שכבה 1 — חיסון המשימה (`worklog-schedule.js`):** ל-`$set` נוספו `-DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -WakeToRun -RestartCount 3 -RestartInterval 5m` (נשמרו `-StartWhenAvailable`+`-ExecutionTimeLimit`). חולץ `buildRegisterScript` טהור (registerTasks רק spawn) כדי שניתן יהיה ל-unit-test בלי לגעת ב-Task Scheduler.
- **שכבה 2 — ריפוי-עצמי (`worklog-backfill.js`, hook #14):** `SessionStart` מפעיל אותו **detached + stdio ignore + try/catch**. סורק 3 ימים אחורה (לא כולל היום), מאתר "רשומות יש אך קובץ-סיכום אין", ומריץ `worklog-summary --daily --date <יום> --email` (אותה קריאה כמו המתוזמן → סיכום+מייל+יומן+last-sent). נעילת-cooldown 5ד׳ מונעת ריצה כפולה.
- **`writeLastSent` מונוטוני** — מתקדם בלבד, כדי ש-backfill של יום ישן לא ירווין את הסמן ויגרום שליחה-חוזרת.
**למה ה-catch-up הקיים לא הספיק:** `pickDeliverDay` מסתכל יום-אחד-אחורה ורק כשמייל מופעל; לסיכום-קובץ ולסנכרון-יומן לא הייתה רשת עצמאית. שכבה 2 מכסה את שלושתם, ללא תלות בשעון.
**נבדק:** 12/12 בדיקות מבודדות (`test-v083.js`, temp HOME + claude-stub נכשל→fallback, 0 טוקנים): דגלי-חיסון · gating per-config · `findMissedDays` (אתמול/חלון/סדר/ריק) · e2e backfill כותב סיכום חסר · אידמפוטנטיות · cooldown. bump 0.8.3, D23.
**הבא:** build + deploy חי (כולל רישום-מחדש של המשימות המחוסנות) + push לשני הריפו + backfill של 2026-06-09.

### 2026-06-08 — מירור היום ליומן שלך (push/unpush + autoPush) + תיקון ציר-זמן (v0.8.2)
**נעשה:**
- **`/worklog push [date]` / `unpush`** — **מירור מלא** של היום (בלוקים + סיכום, ללא סינון) ליומן-היעד של המשתמש, **בנוסף** ל-Work Journal הפרטי (לא מחליף). אידמפוטנטי דרך תג `worklog=<date>` (לחיצה חוזרת = מחליף); נוגע **רק** באירועי-worklog ביעד, לא בפגישות אמיתיות; בלי claude. `unpush` מסיר. `syncDay` קיבל פרמטר `calId` (ברירת מחדל = Work Journal; push = היעד).
- **`calendar.autoPush`** (opt-in, כבוי) — בריצת **רצף סיכום-היום** (כש-`want.deliver`) מתבצע גם מירור ליעד; נכון-לאותו-רגע. `worklog-summary` קורא `tryPushCalendar` (spawn נפרד, fail-safe) כש-`calendar.autoPushEnabled()`.
- **יעד = `calendar.pushCalendarId`, ברירת מחדל `primary`** (פר-משתמש — היומן הראשי של כל אחד; אצל חבר צוות זה שלו, לא barak daniel). **פתרון לפער:** ברירת מחדל primary ⇒ push ידני **תמיד עובד** גם בלי setup. בחירת יומן אחר: `--push-setup` (תפריט אינטראקטיבי) או `--list-calendars` + `push.calendar <id|primary>` (זרימת הסקיל). ה-OAuth scope המלא הקיים מספיק — אין setup מחדש.
- **הצעה opt-in ב-update/install** (דרך הסקיל): מציעים את הפיצ'ר עם המסר המפורש *"לא מחליף את Work Journal, רק מוסיף מירור ליומן שלך"*.
- **תיקון קטן (בקשת משתמש):** "ציר זמן" בסיכום היומי — בוקר/צהריים/ערב **בלי שעות/דקות** בסוגריים.
- **חיווט:** סקיל §10 + dispatcher (`worklog.js push|unpush`) + `worklog-config.js` (`push.calendar`/`autopush`, status מציג מירור) + help.
- **נבדק (לא-הרסני):** build + syntax 15/15 + JSON · config round-trip (autopush on→status→off) · `--list-calendars` חי (token רואה את כל היומנים, primary=barakd). **לא הורץ push חי** (כדי לא לכתוב ל-barak daniel בלי בקשה). הותקן חי 0.8.2. D22.

**הבא:** push/ship לשני הריפו.

### 2026-06-08 — תיקון מיזוג בלוקי-יומן: קיבוץ פר-פרויקט (v0.8.1)
**הבאג (תפס אותו המשתמש מצילומי היומן):** חותמות-פעילות של **אותו פרויקט** בטווח <30ד׳ זו מזו לא התאחדו — turk הופיע כהמון בלוקים זעירים (2:09, 2:24, 2:34...). **שורש:** `streaksOfActivity` בנה רצפים **רציפים-גלובלית** — חותמת של פרויקט אחר *בין* שתי חותמות turk שברה את רצף ה-turk. כך השתלבות (interleaving) turk↔someSkills פיצצה כל פרויקט להרבה בלוקים.
**התיקון:** `streaksByProjectActivity` מקבץ **פר-פרויקט** — לכל פרויקט בנפרד, חותמות שלו בטווח `activityGap` זו מזו = רצף אחד, **סובלני להשתלבות פרויקט אחר**. הוסר ה-clamp הגלובלי (פרויקטים שונים עכשיו עצמאיים → הבלוקים שלהם **רשאים לחפוף** כשהעבודה הייתה משולבת — "לכל פרויקט הקובייה שלו", כבקשת המשתמש). רצפי אותו-פרויקט תמיד >activityGap זה מזה, אז הזנב (10ד׳ < 30) לעולם לא יוצר חפיפה תוך-פרויקטית.
**נבדק:** 8/8 (השתלבות→מיזוג · אותו-פרויקט >30 מתפצל · ≤30 ובדיוק-30 מתאחד · 2 פרויקטים · יום-turk ריאלי · notes · מסלול legacy ללא שינוי). **אומת חי:** re-sync ל-2026-06-08 ירד מ-18 בלוקים ל-11; הצביר turk 12:57–14:44 לבלוק אחד. bump 0.8.1, D21.

### 2026-06-08 — עדכון מקומי (`/worklog update`) + dispatcher לטרמינל + הקשחת פרסר (v0.8.0)
**נעשה (3 שינויים, bump אחד):**
- **`/worklog update` — עדכון מהתיקייה המקומית:** סקריפט חדש `worklog-update.js` משווה **content-manifest** (`sha256` על `src/` + `VERSION`, ב-`worklog-lib.computeManifest`) מול ה-manifest שנחתם בהתקנה — אז גם **hotfix באותה גרסה** או תיקון-יד נתפסים, **לא רק bump**. אם שונה: מדפיס מה השתנה (מ-`upgrade-notes.json`, פר-גרסה) + סעיף "דורש תשומת-לב" (required/optional), ואז מריץ את `install.js` האידמפוטנטי. מסרב downgrade. דגלים: `--check` (dry-run), `--source DIR`. **מודל לוקלי (v1):** המקור = תיקיית ה-setup שהמשתמש ריענן (zip/pull); אין הנחת רשת/auth. **creds לא נוגעים** — `.email-cred`/`.calendar-cred` (DPAPI) מחוץ ל-`src` ומחוץ לתחום של install → עדכון רגיל לא מבקש כלום. `install.js` חותם עכשיו `.installed-manifest`.
- **Dispatcher `worklog.js` (קיצור CLI):** פקודה אחת `worklog.js <verb>` מנתבת ל-סקריפטים הקיימים (`status`/`show`/`send`/`summary`/`week`/`log`/`update`/הגדרות) — במקום לזכור 5 שמות. `help` שוכתב ל**מיפוי צ'אט↔טרמינל** copy-paste. (Tier 0+1 מתוך דיון הקיצור; Tier 2 = shim ל-`$PROFILE` — נדחה כ-opt-in עתידי.) `uninstall` הורחב ל-`worklog*.js` כדי לתפוס גם את ה-dispatcher.
- **הקשחת פרסר-רשומות (fail-safe):** matcher משותף ויחיד ב-`worklog-lib` (`parseEntryLine`/`hasEntryLine`/`entryRe`) שמקבל גם `*` וגם `\\[` — כי format-on-save/מעצב-markdown יכול לשכתב `- [x]` → `* \\[x]` בקובץ היומי. הוחל ב-**5 אתרים** (config-status, calendar-parseEntries, summary-fallback, summary-hasEntries, session-end). בלי זה reformat יחיד מאפס את הספירה ויכול לגרום ל-`hasEntries()` לדלג על יום שלם. **רקע:** התגלה חי — קובץ 2026-06-08 פורמט-מחדש ל-`* \\[...]`, status הציג 1 במקום 9; הסיכום ה-AI עצמו תקין (גולמי→claude), אך הפרסר היה שביר.
- **נבדק:** update 5/5 מסלולים (שדרוג+notes / החלה אמיתית→0.8.0 / "עדכני" / שינוי-תוכן-באותה-גרסה / אין-מקור) · dispatcher (help/show/status/update/לא-מוכר) · פרסר 5 קלטים (dash/asterisk+escaped/רווחים+שני-escaped/לא-רשומות) · **status חי חזר ל-9 רשומות**. הותקן חי 0.8.0 (15 hooks). D18–D20.

**הבא:** build + push לשני הריפו + מיזוג (המשתמש).

### 2026-06-08 — שכבת פעילות לבלוקים מדויקים + catch-up מייל + דילוג-סיכום (v0.7.6)
**נעשה (שתי משימות אוחדו ל-bump אחד):**
- **שכבת פעילות (חדשה) — בלוקי-יומן מדויקים:** hook `UserPromptSubmit` חדש (`worklog-prompt.js`) חותם **זמן+פרויקט בלבד** (ללא תוכן) לפני כל מענה → `.sessions/<date>.activity.jsonl`. מהיר, fail-safe, **stdout ריק** (לא מזריק קונטקסט), מכבד `WORKLOG_DISABLE`. **עיצוב שתי-שכבות:** פעילות (זמנים → בלוקים) נפרדת מתוכן (נקודות-מפתח → סיכום), כדי לא להציף את ה-AI.
- **`computeBlocks` — מסלול activity ראשי:** חותמות אותו-פרויקט בתוך `activityGap=30`ד׳ = בלוק; סוף = חותמת-אחרונה + `tail=10`ד׳, **clamp** שלא יחפוף לבלוק הבא; notes מהרשומות; רשומה לא-מכוסה → fallback. בלי חותמות → המסלול הישן (מעוגן-סשנים) ללא שינוי. **אין Stop hook** (חישוב טהור). 30=פיצול, 10=זנב (שני כפתורים נפרדים).
- **Catch-up מייל (`worklog-summary.js`):** ריצה מתוזמנת (`--email`) שפוספסה (מכונה כבויה) נשלחת למחרת **עבור היום שפוספס** (חלון יומיים, `.email-last-sent`). שליחה ידנית (`send`/`--deliver`) → **תמיד היום, תמיד שולחת**, לא נחסמת מ-last-sent.
- **דילוג-סיכום:** סיכום שלא השתנה (mtime) → שימוש חוזר ללא קריאת `claude` (אפס טוקנים).
- **חיווט:** `worklog-prompt.js` ב-`settings-hooks.json` + `install.js` + הסרה גנרית ב-`uninstall.js`; ברירות-מחדל `activityGapMinutes:30`/`tailMinutes:10` ב-`worklog-schedule.js`/config.
- **backfill ב-installer:** שדרוג משלים מפתחות-config חדשים ל-`config.json` קיים (מיזוג מתחת לערכי המשתמש, גיבוי `.bak`, אידמפוטנטי) — כך הכפתורים גלויים וניתנים-לכוונון, לא רק ברירת-מחדל קשיחה בקוד. *(הבהרה: ה-30/10 ממילא חלים בזמן-קריאה דרך `|| 30`/`!= null` — אין באג; ה-backfill הוא לשקיפות.)* אומת חי: שדרוג ה-config של המשתמש הוסיף 30/10 תוך שימור `email.time=18:00`/calendar; ריצה שנייה = no-op.
- **נבדק — 15/15:** יחידה לבלוקים (tail/split@30/exactly-30/clamp/notes/fallback/no-over-report/legacy) + e2e למייל ב-subprocess עם **fake-claude** (today/reuse/catch-up→אתמול/nothing-new/manual-תמיד-today) + hook ידני (stdout ריק/חותמת-ללא-תוכן/WORKLOG_DISABLE) + אינטגרציה מקצה-לקצה + syntax×8. D17, hook #13, bump 0.7.6.

**הבא:** build + push לשני הריפו + התקנה חיה (הבלוקים המדויקים מתחילים להצטבר מהסשן הבא).

### 2026-06-07 — תיקון UX ב-installer setup (v0.7.5)
**נעשה:**
- **2 באגים שהמשתמש זיהה ב-`--setup`:** (1) prompts בעברית הופיעו **הפוכים** ב-Windows console (BiDi; "כתובת"→"תבותכ"); (2) prompt הסיסמה הופיע רק אחרי **Enter כפול** (race בין Node readline ל-PowerShell Read-Host).
- **תיקון (`worklog-email.js`):** כל קלט ה-setup ב-**PowerShell יחיד** — prompts באנגלית (אין היפוך), קורא-stdin אחד (אין race); מצפין סיסמה DPAPI, מחזיר שדות דרך קובץ JSON זמני. גם הודעות-טרמינל ב-email+calendar (setup/test/disable) → אנגלית.
- **נבדק:** node --check + PS parse-check (13 statements, prompts אנגלית מאומתים). D16, bump 0.7.5. ב-branch ייעודי למיזוג ידני.

**הבא:** המשתמש בודק setup חי + ממזג ל-main; אח״כ קטלוג + install חי.

### 2026-06-05 — תיקון באג הבלוקים + פורמט מותאם-יעד (v0.7.4)
**נעשה:**
- **באג שהמשתמש זיהה:** היומן תפס רק ~8% מעבודת היום. אבחון על נתוני 04/06 (1 session נלכד, 13 רשומות → בלוק אחד): `computeBlocks` זרק כל רשומה שמחוץ למרווח-סשן.
- **תיקון 1 — fallback מבוסס-רשומות** (`worklog-blocks.js`): רשומות לא-מכוסות → בלוקים (`streaksOf` משותף). **אומת חי:** 04/06 עכשיו 3 בלוקים שמכסים את כל היום, כל 13 הרשומות נכנסות.
- **תיקון 2 — `worklog-format.js`** (פורמט מותאם-יעד; רעיון #3 שנדחה מ-0.6): מייל=HTML (`-BodyAsHtml`), תיאור-יומן=`toCalHtml` (subset שגוגל קלנדר מרנדר), `toPlain` ל-fallback. **אומתו ויזואלית חי** (מייל + יומן) ע"י המשתמש.
- **22/22 בדיקות** (fallback/regression/real-04/06/format) + 2 אימותי-חי (`--sync` ליומן, `sendSummary` למייל). D15. bump 0.7.4, סונכרנו כל המסמכים (כולל version-only).

**הבא:** build + install חי + push לשני הריפו.

### 2026-06-05 — ביקורת עקביות מסמכים + תיקוני uninstall (השלמת 0.7.3)
**נעשה:**
- סריקה שיטתית של כל המסמכים בשני הריפו מול 0.7.3 (Explore + ידנית על `src/`, שה-Explore לא כיסה).
- תוקנו: version badges (README 0.7.2→0.7.3, SEND-TO-TEAMMATE 0.7.1→0.7.3 + הוספת status/send/help להודעת-הצוות), הוראת calendar ל-mirror (`SKILL.tpl` §8, `INSTALL` כותרת+פתיח), comments מיושנים (`summary.js` "Friday weekly"→Sunday, `lib.js` "generated Friday").
- **2 באגי `uninstall.js` שתוקנו:** (1) לא הסיר `WorkJournal-Notify` (משימת 18:00 נשארה תלויה); (2) `HOOK_FILES` קשיח הסיר רק 5/11 hooks — שונה ל**מחיקה גנרית** `worklog-*.js` (עמיד-לעתיד, תואם ל-install שמעתיק את כל התיקייה).
- **ללא bump** — השלמת 0.7.3 (נדחף דקות קודם, טרם אומץ); נמנע version-churn מיותר (החלטה אחרי שהמשתמש העיר).

**הבא:** build + push לשני הריפו (patch תחת 0.7.3).

### 2026-06-04 — help (v0.7.2) + יומן כ-mirror מתמשך (v0.7.3)
**נעשה:**
- **v0.7.2:** `/worklog help` — מסך אחד עם כל הפקודות (סקיל + CLI; מנוע `worklog-config.js help`). תיקון `install.js` (שימור calendar+language ברישום משימות מחדש). הותקן חי + נדחף לשני הריפו.
- **v0.7.3 — יומן כ-mirror מתמשך:** פער שזיהה המשתמש — סנכרון היומן היה קשור ל-20:30/ידני בלבד, אז עבודה אחרי 20:30 לא הופיעה. הבחנה: **מייל = push חד-פעמי · יומן = mirror מתמשך**. `worklog-session-end.js` מסנכרן בכל סגירת סשן (detached fire-and-forget; calendar-gated + רק-אם הסשן תרם; פיצול-חצות → 2 ימים). הנרטיב מתחדש ב-20:30/`send` בלבד (לא AI בכל סשן); הבלוקים תמיד.
- **10/10 בדיקות מבודדות** (stub calendar: spawn enabled/disabled, midnight-split, עמידות). אומת שהשבועי כבר catch-all (קורא יומנים גולמיים → תופס ערב שהמייל פספס). D14 + CALENDAR-SPEC + 6 מסמכים.

**הבא:** build + push 0.7.3 לשני הריפו + התקנה חיה.

### 2026-06-04 — מימוש ממשק on-demand (v0.7.1)
**נעשה:**
- מומש לפי ה-spec: `worklog send` (regenerate→שלח לכל יעד מופעל; בורר `send email`/`send calendar`), `worklog status` (תצוגת-על מאוחדת), ובחירת **שפת סיכום** (`config.language`, חופשי, ברירת מחדל עברית — מוזרק ל-prompt).
- **refactor מינימלי, תאימות מלאה:** `--deliver` ב-summary כ-alias סמנטי ל-`--email` (ה-scheduler לא נגעתי); גארד "אין רשומות→אל תשלח"; `--only email|calendar`; הזרקת שפה ל-prompt יומי+שבועי. `status`+`language` ב-config; `language` ב-defaultConfig/describe.
- **18/18 בדיקות מבודדות עברו** (USERPROFILE זמני + claude stub): syntax (11 קבצים), הזרקת שפה (English/עברית), gating יעדים, גארד אין-רשומות, `--only`, `status`. **אפס נגיעה בסביבה החיה.**
- bump 0.7.1; סונכרנו 9 מסמכים (README/SUMMARY/ARCHITECTURE/DECISIONS D13/INSTALL/SKILL×2/SEND-TO-TEAMMATE/ONDEMAND-SPEC) + PROGRESS.

**הבא:** build + push לשני הריפו (dev + קטלוג).

### 2026-06-04 — אפיון ממשק on-demand (send + status)
**נעשה:**
- מופו 3 פערים: אין "שלח עכשיו" (דליברי נעול ל-20:30); הדגל `--email` מטעה (שולט גם ביומן); אין תצוגת-על מאוחדת.
- אופיין מול המשתמש (4 הכרעות): פקודה `worklog send` (פועל ייעודי) · **תמיד regenerate** ואז שלח · **רק יעדים מופעלים** (בלי one-shot override) · `worklog status` מאוחד.
- נכתב [ONDEMAND-SPEC.md](./ONDEMAND-SPEC.md): מודל הפקודות, refactor מינימלי (`--deliver` כ-alias ל-`--email`, גארד "אין רשומות", `status` ב-config), מקרי-קצה, ולא-בסקופ.
- **תובנה:** "תמיד regenerate" היא ממילא התנהגות `doDaily` — המימוש בעיקר העברת דגל הדליברי + גארדים, לא לוגיקה חדשה.

**הבא:** מימוש לפי ה-spec (Next Up #1) — שינוי `worklog-summary.js` + `worklog-config.js` + skill, bump 0.7.1, re-ship.

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
