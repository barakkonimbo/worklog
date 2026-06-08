---
name: worklog
description: Manual control of the global work-journal (יומן עבודה). Use when the user wants to log an entry by hand, see today's journal or status, generate the daily/weekly summary, send it now to email/calendar on demand, or change settings like the summary language. Triggers on "/worklog", "תרשום ביומן", "log this to the journal", "what did I do today", "show my work journal", "worklog status", "מצב היומן", "worklog help", "what can the work journal do", "אילו פקודות יש ביומן", "send the summary now", "שלח עכשיו", "generate today's summary now", "סיכום יום עכשיו", "סיכום שבועי", "change summary language", "שנה שפת סיכום", "update the work journal", "עדכן את היומן", "worklog update", "is there a new version". The automatic logging is handled by hooks; this skill is for explicit, on-demand actions.
---

# Work Journal — manual control

The global work-journal lives at `{{JOURNAL_DIR}}`. Daily logs are
`YYYY-MM-DD.md` (raw entries), daily summaries `summary-YYYY-MM-DD.md`, weekly `YYYY-Www-weekly.md`.
Hooks already auto-load and auto-log; this skill handles explicit actions.

Constants (filled in at install time):
- NODE = `{{NODE}}`
- HOOKS = `{{HOOKS_DIR}}`
- JOURNAL = `{{JOURNAL_DIR}}`

Decide the action from the user's argument/intent:

> **Help / "what can I do" / `/worklog help`** → run `"<NODE>" "<HOOKS>/worklog-config.js" help` and
> show its output verbatim (the full command list — both the `/worklog` skill actions and the direct CLI).

## 1. Log an entry (default when free text is given)
Run via Bash, project tag inferred from the current working directory:
`"<NODE>" "<HOOKS>/worklog-log.js" --msg "<the entry text, one short line>"`
To force a project tag: add `--project "<name>"`.
Confirm in one line what was logged. Keep entries short and high-level.

## 2. Show today's journal
Read `<JOURNAL>/<today>.md` and display it. If it doesn't exist,
say nothing has been logged today yet. (Today's date is available in the session context.)

## 3. Status — unified view ("what's my work-journal status / setup")
`"<NODE>" "<HOOKS>/worklog-config.js" status`
One block: today's activity (entries + projects, whether the daily summary exists),
the targets (email/calendar on-off + whether configured + address), the summary language,
and what is scheduled next. Print it back to the user.

## 4. Generate the daily summary now — create only (don't wait for 18:00)
`"<NODE>" "<HOOKS>/worklog-summary.js" --daily`
Then read and show `<JOURNAL>/summary-<today>.md`. This invokes Claude headless (~30-60s).
This only *writes* the summary file — it does NOT email or sync to calendar. To also send, use `send` (§6).

## 5. Generate the weekly summary now
`"<NODE>" "<HOOKS>/worklog-summary.js" --weekly`
Then read and show the latest `<JOURNAL>/YYYY-Www-weekly.md`. (Summarizes the previous 7 days.)

## 6. Send the summary now — deliver on-demand (regenerate + send)
For "send now" / "שלח עכשיו" / "email me the summary now". Regenerates today's summary and sends it
to every ENABLED target (email if on, calendar if on):
`"<NODE>" "<HOOKS>/worklog-summary.js" --daily --deliver`
- Single target only: add `--only email` or `--only calendar` (e.g. "send just the email now").
- It sends only to targets that are **enabled**. If none are enabled, tell the user nothing was sent and
  point to §7/§8 to enable. If there are no entries today, nothing is sent ("no activity logged today").
- Report what was delivered (the command prints `sent to …` / `synced …`).

## 7. Settings — email/calendar on/off, times, days, language (easy)
Settings live in `<JOURNAL>/config.json` and are changed via the config tool, which also
re-registers the scheduled tasks automatically. Map the user's intent to one call:
- Show current settings: `"<NODE>" "<HOOKS>/worklog-config.js"`
- Daily email OFF / ON: `"<NODE>" "<HOOKS>/worklog-config.js" email off`  /  `… email on`
- Daily email time: `… worklog-config.js email.time 21:00`
- Days: `… worklog-config.js email.days Sun-Thu`  (or `Sun,Mon,Tue,Wed,Thu`)
- Weekly: `… worklog-config.js weekly off` · `weekly.day Sunday` · `weekly.time 08:00`
- Google Calendar OFF / ON: `… worklog-config.js calendar off` / `calendar on` (needs `--setup` first)
- Summary language: `… worklog-config.js language English` (free-form, e.g. `English`/`עברית`/`Español`;
  default עברית). Sets the language Claude writes the summary in — affecting what's sent to all targets.

Two-level model: first choice is whether email/calendar are on at all (default OFF). If on, email uses the
defaults — daily **20:30 Sun–Thu**, weekly **Sunday 08:00** — or the user's own times/days.
The **18:00 Sun–Thu** interim notification (toast only) is fixed and always on.

## 8. Enable email / Google Calendar for the first time
Both are OFF by default and need a one-time setup with hidden input / browser consent, so tell the user
to run it in their OWN terminal (PowerShell/cmd) — not via this skill:
- **Email:** `node "<HOOKS>/worklog-email.js" --setup`  then  `… --test` (Gmail App Password).
- **Google Calendar:** create a Desktop OAuth client in Google Cloud (enable Calendar API · consent screen
  Internal · copy Client ID+Secret), then `node "<HOOKS>/worklog-calendar.js" --setup`  then  `… --test`.
  Syncs time-blocks + a daily summary event to a dedicated "Work Journal" calendar — on every session
  close (a continuous mirror) and at the 20:30 run (which also refreshes the summary event).
  (Full step-by-step in the project's INSTALL.md.)

## 9. Update the system (`/worklog update`)
For "update the work journal" / "עדכן את היומן" / "is there a new version". Updates from the locally
refreshed setup folder (`<CLAUDE_CONFIG_DIR or ~/.claude>/skills/work-journal-setup/`) — so first remind
the user to refresh that folder (extract the new zip / pull the catalog) if they haven't.
`"<NODE>" "<HOOKS>/worklog-update.js"`
- It compares a content manifest (not just the version number), so a same-version hotfix is caught too.
- If nothing differs it prints "עדכני — אין מה לעדכן" — relay that, done.
- If it updates, it prints **what changed** and a "⚠️ דורש תשומת-לב" section. **Surface those items.** If any is
  marked **חובה (required)** and needs hidden input (e.g. re-running `worklog-email.js --setup` /
  `worklog-calendar.js --setup`), guide the user to run it in their OWN terminal — do NOT run setup yourself.
- A normal update touches NO credentials and asks for nothing; reassure the user of that if they worry.
- Preview without applying: add `--check` (dry run). Override the source folder: `--source <path>`.

## Notes
- Terminal users can drive everything via one dispatcher instead of remembering each script:
  `node "<HOOKS>/worklog.js" <verb>` — e.g. `status`, `show`, `send`, `update`, `summary`, `week`,
  `log "text"`, or any settings verb (`email off`, `language English`). `worklog help` prints the full
  chat↔terminal map. (This skill itself calls the specific scripts directly; the dispatcher is for humans.)
- The summary generator prevents recursion (`WORKLOG_DISABLE=1`), so running it from a session is safe.
- For a specific past date: append `--date YYYY-MM-DD` to the summary command.
- `send` = `--daily --deliver`; the scheduled 20:30 run uses `--daily --email` (a back-compat alias of `--deliver`).
- Full design is documented in the work-journal project (`docs/`).
