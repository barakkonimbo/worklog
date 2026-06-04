---
name: worklog
description: Manual control of the global work-journal (יומן עבודה). Use when the user wants to log an entry by hand, see today's journal, or generate the daily/weekly summary on demand. Triggers on "/worklog", "תרשום ביומן", "log this to the journal", "what did I do today", "show my work journal", "generate today's summary now", "סיכום יום עכשיו", "סיכום שבועי". The automatic logging is handled by hooks; this skill is for explicit, on-demand actions.
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

## 1. Log an entry (default when free text is given)
Run via Bash, project tag inferred from the current working directory:
`"<NODE>" "<HOOKS>/worklog-log.js" --msg "<the entry text, one short line>"`
To force a project tag: add `--project "<name>"`.
Confirm in one line what was logged. Keep entries short and high-level.

## 2. Show today's journal
Read `<JOURNAL>/<today>.md` and display it. If it doesn't exist,
say nothing has been logged today yet. (Today's date is available in the session context.)

## 3. Generate the daily summary now (don't wait for 18:00)
`"<NODE>" "<HOOKS>/worklog-summary.js" --daily`
Then read and show `<JOURNAL>/summary-<today>.md`. This invokes Claude headless (~30-60s).

## 4. Generate the weekly summary now
`"<NODE>" "<HOOKS>/worklog-summary.js" --weekly`
Then read and show the latest `<JOURNAL>/YYYY-Www-weekly.md`. (Summarizes the previous 7 days.)

## 5. Settings — email on/off, times, days (easy)
Settings live in `<JOURNAL>/config.json` and are changed via the config tool, which also
re-registers the scheduled tasks automatically. Map the user's intent to one call:
- Show current settings: `"<NODE>" "<HOOKS>/worklog-config.js"`
- Daily email OFF / ON: `"<NODE>" "<HOOKS>/worklog-config.js" email off`  /  `… email on`
- Daily email time: `… worklog-config.js email.time 21:00`
- Days: `… worklog-config.js email.days Sun-Thu`  (or `Sun,Mon,Tue,Wed,Thu`)
- Weekly: `… worklog-config.js weekly off` · `weekly.day Sunday` · `weekly.time 08:00`
- Google Calendar OFF / ON: `… worklog-config.js calendar off` / `calendar on` (needs `--setup` first)

Two-level model: first choice is whether email/calendar are on at all (default OFF). If on, email uses the
defaults — daily **20:30 Sun–Thu**, weekly **Sunday 08:00** — or the user's own times/days.
The **18:00 Sun–Thu** interim notification (toast only) is fixed and always on.

## 6. Enable email / Google Calendar for the first time
Both are OFF by default and need a one-time setup with hidden input / browser consent, so tell the user
to run it in their OWN terminal (PowerShell/cmd) — not via this skill:
- **Email:** `node "<HOOKS>/worklog-email.js" --setup`  then  `… --test` (Gmail App Password).
- **Google Calendar:** create a Desktop OAuth client in Google Cloud (enable Calendar API · consent screen
  Internal · copy Client ID+Secret), then `node "<HOOKS>/worklog-calendar.js" --setup`  then  `… --test`.
  Syncs time-blocks + a daily summary event to a dedicated "Work Journal" calendar at the 20:30 run.
  (Full step-by-step in the project's INSTALL.md.)

## Notes
- The summary generator prevents recursion (`WORKLOG_DISABLE=1`), so running it from a session is safe.
- For a specific past date: append `--date YYYY-MM-DD` to the summary command.
- Full design is documented in the work-journal project (`docs/`).
