#!/usr/bin/env node
// worklog-session-start.js — SessionStart hook.
// 1) Injects today's (+ yesterday's) journal and the logging instruction into the session.
// 2) Writes a per-session marker used by the SessionEnd safety net.
//
// Wired in ~/.claude/settings.json under hooks.SessionStart.

const fs = require('fs');
const path = require('path');
const lib = require('./worklog-lib.js');

// Recursion guard: the summary generator spawns `claude -p` with WORKLOG_DISABLE=1
// so this hook (inherited via env) does nothing during a summary run.
if (process.env.WORKLOG_DISABLE === '1') process.exit(0);

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function toFwd(p) { return String(p).replace(/\\/g, '/'); }

let data = {};
try { data = JSON.parse(readStdin() || '{}'); } catch { data = {}; }

lib.ensureDirs();
const d = lib.now();
const cwd = data.cwd || process.cwd();
const sid = data.session_id || '';
const proj = lib.projectFromCwd(cwd);

// --- session marker (safety-net bookkeeping) ---
// E5: create only if absent, so compact/resume re-firing SessionStart for the same
// session keeps the ORIGINAL start time (used as the real session-start anchor for
// Calendar blocks). The marker is removed at SessionEnd.
if (sid) {
  const markerPath = path.join(lib.SESSIONS, sanitize(sid) + '.json');
  if (!fs.existsSync(markerPath)) {
    try {
      fs.writeFileSync(
        markerPath,
        JSON.stringify({
          session_id: sid,
          cwd,
          project: proj,
          startDate: lib.dateKey(d),
          startTime: lib.timeKey(d),
          source: data.source || '',
        }),
        'utf8'
      );
    } catch { /* non-fatal */ }
  }
}

// --- self-heal (v0.8.3): backfill any recent day that has entries but no summary ---
// The scheduled end-of-day run can be killed mid-generation (laptop asleep/on-battery → 0x8007042B),
// leaving a day with no summary, no email, no calendar. A real session means the machine is on, so we
// regenerate + deliver the missed day in the BACKGROUND. Detached + stdio ignored + try/catch so it can
// never block session start nor leak to stdout (this hook's stdout is injected as session context).
try {
  const { spawn } = require('child_process');
  const backfill = path.join(__dirname, 'worklog-backfill.js');
  if (fs.existsSync(backfill)) {
    const child = spawn(process.execPath, [backfill], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  }
} catch { /* non-fatal */ }

// --- build injected context (cap ~9000 chars; additionalContext limit is 10k) ---
const node = toFwd(process.execPath);
const logScript = toFwd(path.join(__dirname, 'worklog-log.js'));

let today = lib.readIf(lib.dailyFile(d)).trim();
const yd = new Date(d); yd.setDate(d.getDate() - 1);
let yest = lib.readIf(lib.dailyFile(yd)).trim();

if (today.length > 6000) today = '…(מקוצר)\n' + today.slice(-6000);
if (yest.length > 1500) yest = yest.slice(0, 1500) + '\n…(נחתך)';

let ctx = '';
ctx += '# 📓 יומן עבודה (Work Journal) — פעיל בכל סשן\n\n';
ctx += 'לאורך הסשן תַעֵד התקדמות ביומן העבודה היומי.\n';
ctx += '**מתי לתעד:** סיום משימה, מעבר נושא/פרויקט, פתיחת או מיזוג PR, החלטה או ממצא חשוב.\n';
ctx += '**מתי לא:** צעדי ביניים טריוויאליים, ניסוי-וטעייה.\n\n';
ctx += '**איך לתעד** — הרץ דרך כלי Bash:\n';
ctx += '`"' + node + '" "' + logScript + '" --msg "<תיאור קצר במשפט אחד>"`\n';
ctx += 'תג הפרויקט נקבע אוטומטית מהתיקייה (כרגע: `[' + proj + ']`). לכפיית תג: `--project "<שם>"`.\n';
ctx += 'שמור רשומות קצרות, שורה אחת, תמציתי. אל תטריח את המשתמש בהודעה על כך שתיעדת אלא אם ביקש.\n\n';
ctx += '## מה כבר תועד היום (' + lib.dateKey(d) + ', ' + lib.hebDow(d) + ')\n';
ctx += (today ? today : '— עדיין לא תועד דבר היום —') + '\n';
if (yest) {
  ctx += '\n## אתמול (להקשר בלבד)\n' + yest + '\n';
}

if (ctx.length > 9500) ctx = ctx.slice(0, 9500) + '\n…';

const out = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: ctx,
  },
};
process.stdout.write(JSON.stringify(out));
process.exit(0);
