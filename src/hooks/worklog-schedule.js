#!/usr/bin/env node
/*
 * worklog-schedule.js — config-driven Windows Task Scheduler registration.
 * Shared by install.js, worklog-config.js, and worklog-email.js so the schedule
 * always reflects config.json. Re-registering is a full reset (unregister all → register applicable).
 *
 * Tasks produced:
 *   WorkJournal-Notify      18:00, Sun–Thu, `--daily`         interim summary + toast (FIXED for everyone)
 *   WorkJournal-DailyEmail  email.time/days, `--daily --email`  final summary + email  (only if email.enabled)
 *   WorkJournal-Weekly      weekly.day/time, `--weekly --email` last-week recap + email (only if email+weekly enabled)
 */

const { spawnSync } = require('child_process');

const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAP = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

// Accepts array or string; supports "Sun-Thu", "Sun,Mon", full names. Returns full day names.
function parseDays(input) {
  if (Array.isArray(input)) input = input.join(',');
  const out = new Set();
  for (let tok of String(input || '').split(',')) {
    tok = tok.trim().toLowerCase();
    if (!tok) continue;
    if (tok.includes('-')) {
      const [a, b] = tok.split('-').map((s) => MAP[s.trim()]);
      if (a != null && b != null) for (let i = a; i <= b; i++) out.add(i);
    } else if (MAP[tok] != null) out.add(MAP[tok]);
  }
  const days = [...out].sort((x, y) => x - y).map((i) => FULL[i]);
  return days.length ? days : FULL.slice(0, 5); // default Sun–Thu
}

function defaultConfig() {
  return {
    language: 'עברית', // output language for AI summaries (free-form; Claude writes in any language)
    email: {
      enabled: false, to: '', from: '', smtpHost: 'smtp.gmail.com', smtpPort: 587,
      time: '20:30', days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    },
    weekly: { enabled: true, day: 'Sunday', time: '08:00' },
    calendar: {
      enabled: false, calendarId: '', summaryEvent: true,
      minBlockMinutes: 15, maxGapMinutes: 90,
      activityGapMinutes: 30, // per-prompt stamps farther apart than this start a new block
      tailMinutes: 10,        // each block runs this many minutes past its last stamp
      pushCalendarId: 'primary', // target for `/worklog push` (full mirror); 'primary' = the user's own main calendar
      autoPush: false,        // opt-in: also mirror to pushCalendarId during the end-of-day summary run
    },
  };
}

const ALL_TASKS = ['WorkJournal-Daily', 'WorkJournal-Notify', 'WorkJournal-DailyEmail', 'WorkJournal-Weekly'];

// Human-readable description of what is currently scheduled (for --show and reports).
function describe(config) {
  const c = config;
  const lines = [];
  lines.push('• התראת ביניים: 18:00, א׳–ה׳ (קבוע)');
  if (c.email && c.email.enabled) {
    lines.push('• מייל יומי סופי: ' + (c.email.time || '20:30') + ', ' + parseDays(c.email.days).join('/'));
    if (!c.weekly || c.weekly.enabled !== false) {
      lines.push('• מייל שבועי: ' + (c.weekly.day || 'Sunday') + ' ' + (c.weekly.time || '08:00') + ' (סיכום השבוע שעבר)');
    }
    lines.push('• יעד מייל: ' + (c.email.to || '—'));
  } else {
    lines.push('• מייל: כבוי (רק התראה + /worklog summary לפי דרישה)');
  }
  if (c.calendar && c.calendar.enabled) {
    lines.push('• יומן Google: סנכרון יומי (סוף יום) ליומן "Work Journal"' + (c.calendar.summaryEvent === false ? ' — בלוקים בלבד' : ' — בלוקים + סיכום'));
    if (c.calendar.autoPush) {
      lines.push('• מירור אוטומטי: בסוף יום גם → "' + (c.calendar.pushCalendarId || 'primary') + '" (push)');
    }
  } else {
    lines.push('• יומן Google: כבוי');
  }
  lines.push('• שפת הסיכום: ' + (c.language || 'עברית'));
  return lines.join('\n');
}

// Build the PowerShell command that (re)registers the tasks for a config. Pure (no side effects) so it
// can be unit-tested without touching the real Task Scheduler. registerTasks() spawns the result.
function buildRegisterScript({ node, summaryScript, config }) {
  const c = config || defaultConfig();
  const q = (s) => String(s).replace(/'/g, "''");

  function task(name, args, time, days, desc) {
    return "$a=New-ScheduledTaskAction -Execute $node -Argument ('\"'+$script+'\" " + args + "'); " +
      "Register-ScheduledTask -TaskName '" + name + "' -Action $a -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek " +
      days.join(',') + " -At ([datetime]'" + time + "')) -Settings $set -Description '" + q(desc) + "' -Force | Out-Null";
  }

  const lines = [
    "$node='" + q(node) + "'",
    "$script='" + q(summaryScript) + "'",
    // Resilience (v0.8.3): a laptop is rarely awake-and-plugged at exactly the run time.
    //   -StartWhenAvailable        run a missed trigger as soon as the machine is next awake
    //   -WakeToRun                 wake from sleep to run at the scheduled time
    //   -DontStopIfGoingOnBatteries / -AllowStartIfOnBatteries
    //                              the old defaults KILLED the task on battery mid-run (→ 0x8007042B,
    //                              ERROR_PROCESS_ABORTED: summary half-generated, nothing sent)
    //   -RestartCount/-RestartInterval  if a run still fails (abort/crash), retry up to 3× every 5 min
    // The session-start backfill (worklog-backfill.js) is the final safety net for anything still missed.
    "$set=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -WakeToRun -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)",
    // full reset so toggling off actually removes tasks (and clears the legacy WorkJournal-Daily)
    'Unregister-ScheduledTask -TaskName ' + ALL_TASKS.map((t) => "'" + t + "'").join(',') + ' -Confirm:$false -ErrorAction SilentlyContinue',
    // fixed interim notification (everyone)
    task('WorkJournal-Notify', '--daily', '18:00', parseDays(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']), 'Interim daily summary + notification (18:00, Sun-Thu)'),
  ];
  const emailOn = !!(c.email && c.email.enabled);
  const calOn = !!(c.calendar && c.calendar.enabled);
  // Final end-of-day run (20:30). Email delivery and calendar sync each self-gate inside;
  // register the task if EITHER is enabled so calendar works even without email.
  if (emailOn || calOn) {
    lines.push(task('WorkJournal-DailyEmail', '--daily --email', (c.email && c.email.time) || '20:30', parseDays(c.email && c.email.days), 'Final daily summary (email if enabled, calendar sync if enabled)'));
  }
  if (emailOn && (!c.weekly || c.weekly.enabled !== false)) {
    lines.push(task('WorkJournal-Weekly', '--weekly --email', (c.weekly && c.weekly.time) || '08:00', parseDays([(c.weekly && c.weekly.day) || 'Sunday']), 'Weekly recap + email'));
  }
  lines.push("Write-Output 'ok'");
  return lines.join('; ');
}

// Register tasks from config. Windows-only; returns { ok, stderr, reason }.
function registerTasks({ node, summaryScript, config }) {
  if (process.platform !== 'win32') return { ok: false, reason: 'not-windows' };
  const command = buildRegisterScript({ node, summaryScript, config });
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
  return { ok: r.status === 0, stderr: (r.stderr || r.stdout || '').trim() };
}

module.exports = { defaultConfig, registerTasks, buildRegisterScript, parseDays, describe, ALL_TASKS };
