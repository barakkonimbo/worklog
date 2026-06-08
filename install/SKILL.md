---
name: work-journal-setup
description: One-shot installer for the global Work Journal system (יומן עבודה אוטומטי). Use when a user wants to install, set up, enable, or remove the work-journal — auto daily/weekly work logging with AI summaries. Triggers on "/work-journal-setup", "install work journal", "set up the work journal", "התקן יומן עבודה", "הפעל יומן עבודה", "uninstall work journal", "הסר יומן עבודה". Run this once; afterwards logging is automatic and `/worklog` controls it manually.
---

# Work Journal — setup

This skill installs (or removes) the Work Journal system on this machine. The installer and the
full source are bundled inside this skill's own folder (`install.js`, `uninstall.js`, `src/`).

**Prerequisite:** Node.js must be on PATH (`node --version`). If missing, tell the user to install Node first.

## Locate the bundled installer
This skill lives at the skills directory: `<CLAUDE_CONFIG_DIR or ~/.claude>/skills/work-journal-setup/`.
The installer is `install.js` in that same folder.

## Install (default)
Confirm intent in one line, then run (the installer is idempotent — safe to re-run):

```bash
# macOS / Linux
node "$HOME/.claude/skills/work-journal-setup/install.js"
```
```powershell
# Windows
node "$env:USERPROFILE\.claude\skills\work-journal-setup\install.js"
```

Then report the installer's output and tell the user: **the system activates on their NEXT Claude Code
session.** Summaries land in `~/.claude/work-journal/`; manual control is the `/worklog` skill.

> Note: automatic daily/weekly summaries are scheduled via Windows Task Scheduler. On macOS/Linux
> the installer skips scheduling — mention that summaries can be generated manually with
> `/worklog summary` until cron/launchd support is added.

## After install — offer email (optional, recommended to ask)
Email is OFF by default. After a successful install, **ask the user** (one short question) whether they
want the end-of-day summary emailed to them. If **yes**, guide them through it — do NOT run `--setup`
yourself, because the app-password prompt is hidden and needs their real terminal:

1. Create a Google App Password: https://myaccount.google.com/apppasswords (needs 2-Step Verification).
   - Google Workspace: if "App passwords" is missing, the admin disabled it → fall back to generic SMTP.
2. In their terminal (PowerShell/cmd):
   `node "%USERPROFILE%\.claude\hooks\worklog-email.js" --setup`
   prompts: to → from (Enter=same) → SMTP host (Enter=`smtp.gmail.com`) → port (Enter=`587`) →
   App Password (hidden — paste, won't show).
3. Test: `node "%USERPROFILE%\.claude\hooks\worklog-email.js" --test` → a test mail should arrive.

Defaults once enabled: daily **20:30 Sun–Thu**, weekly **Sunday 08:00**. If **no** — nothing else needed;
they still get the 18:00 toast and `/worklog summary` on demand.

## After install — offer Google Calendar (optional)
Calendar sync is OFF by default. If the user wants their day mirrored to Google Calendar (time-blocks
per project + a daily summary event, in a dedicated "Work Journal" calendar — never touching real events),
guide them — do NOT run it for them (browser consent needed):
1. Create an OAuth client (one-time) at https://console.cloud.google.com: New Project → enable **Google
   Calendar API** → OAuth consent screen **Internal** (Workspace) → Credentials → OAuth client ID →
   **Desktop app** → copy Client ID + Secret. (Don't start the $300 trial. Prefer Internal — External
   testing tokens expire after 7 days.)
2. In their terminal: `node "%USERPROFILE%\.claude\hooks\worklog-calendar.js" --setup` (paste ID+secret,
   approve in the browser; token stored DPAPI-encrypted).
3. Test: `node "%USERPROFILE%\.claude\hooks\worklog-calendar.js" --test`.
Sync runs on **every session close** (the calendar is a continuously-updated mirror — late work after 20:30 still lands in it) and at the 20:30 run (which also refreshes the summary event). See INSTALL.md for the full guide.

## Change settings later
Map the user's intent to `worklog-config.js` (each change re-registers the tasks automatically):
`email off` / `email on` · `calendar off` / `calendar on` · `email.time 21:00` · `email.days Sun-Thu` ·
`weekly.day Sunday` · `weekly.time 08:00` · `language English` (summary output language, default עברית).
Run it with no args to show current settings, or `status` for the unified view.

Day-to-day control is the `/worklog` skill: `help` (full command list, with a copy-paste chat↔terminal map) /
`show` / `status` / `summary` / `week` / `send` (regenerate + deliver now to every enabled target, optionally
`send email` / `send calendar`) / `update` (update from the locally-refreshed setup folder — detects by content,
explains what changed, flags any required action; never touches credentials). Terminal users can run any of these
via one dispatcher: `node "<HOOKS>/worklog.js" <verb>`.

## Uninstall (only when asked)
```bash
node "$HOME/.claude/skills/work-journal-setup/uninstall.js"            # keep the journal data
node "$HOME/.claude/skills/work-journal-setup/uninstall.js" --purge    # also delete the logs
```
(Windows: use `$env:USERPROFILE\.claude\...`.)

## What gets installed
- hooks → `~/.claude/hooks/worklog*.js` (SessionStart injects the journal; SessionEnd is the safety net;
  plus the `worklog.js` terminal dispatcher and `worklog-update.js`)
- skill → `~/.claude/skills/worklog/` (the `/worklog` manual control)
- a short block merged into `~/.claude/CLAUDE.md`
- SessionStart + SessionEnd entries merged into `~/.claude/settings.json` (existing hooks preserved; backed up)
- scheduled task (Windows): `WorkJournal-Notify` 18:00 Sun–Thu (toast only). The final-run task
  `WorkJournal-DailyEmail` 20:30 Sun–Thu is added if **email OR calendar** is enabled (it sends the
  email if on, and syncs Google Calendar if on); `WorkJournal-Weekly` Sunday 08:00 is added only if email is on.
- optional, off by default: **email** (`worklog-email.js --setup`) and **Google Calendar**
  (`worklog-calendar.js --setup`) — both store credentials DPAPI-encrypted.
