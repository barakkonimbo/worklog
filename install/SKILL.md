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

## Change settings later
Map the user's intent to `worklog-config.js` (each change re-registers the tasks automatically):
`email off` / `email on` · `email.time 21:00` · `email.days Sun-Thu` · `weekly.day Sunday` ·
`weekly.time 08:00`. Run it with no args to show current settings.

## Uninstall (only when asked)
```bash
node "$HOME/.claude/skills/work-journal-setup/uninstall.js"            # keep the journal data
node "$HOME/.claude/skills/work-journal-setup/uninstall.js" --purge    # also delete the logs
```
(Windows: use `$env:USERPROFILE\.claude\...`.)

## What gets installed
- hooks → `~/.claude/hooks/worklog-*.js` (SessionStart injects the journal; SessionEnd is the safety net)
- skill → `~/.claude/skills/worklog/` (the `/worklog` manual control)
- a short block merged into `~/.claude/CLAUDE.md`
- SessionStart + SessionEnd entries merged into `~/.claude/settings.json` (existing hooks preserved; backed up)
- scheduled task (Windows): `WorkJournal-Notify` 18:00 Sun–Thu (toast only). Email tasks
  (`WorkJournal-DailyEmail` 20:30 Sun–Thu, `WorkJournal-Weekly` Sunday 08:00) are added **only if the
  user enables email**.
