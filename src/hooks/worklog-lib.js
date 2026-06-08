// worklog-lib.js — shared helpers for the global work-journal system.
// Plain CommonJS, no deps. Used by worklog-log.js and the session hooks.
//
// Journal layout (all under ~/.claude/work-journal/):
//   YYYY-MM-DD.md            daily log  (append-only entries)
//   summary-YYYY-MM-DD.md    daily summary  (generated 18:00)
//   YYYY-Www-weekly.md       weekly summary (generated Sunday 08:00)
//   .sessions/<id>.json      per-session marker (hybrid safety-net bookkeeping)

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.join(os.homedir(), '.claude', 'work-journal');
const SESSIONS = path.join(ROOT, '.sessions');

function ensureDirs() {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.mkdirSync(SESSIONS, { recursive: true });
}

const pad = (n) => String(n).padStart(2, '0');
const now = () => new Date();

const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeKey = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Hebrew day-of-week letters, Sunday-first (getDay(): 0=Sunday).
const HEB_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'];
const hebDow = (d) => HEB_DAYS[d.getDay()];

const dailyFile = (d) => path.join(ROOT, `${dateKey(d)}.md`);
const summaryFile = (d) => path.join(ROOT, `summary-${dateKey(d)}.md`);
// Per-prompt activity stamps (one file per day, under .sessions/). Dense time-only heartbeat used
// to compute accurate calendar blocks; carries NO content, so it never reaches the AI summary.
const activityFile = (d) => path.join(SESSIONS, `${dateKey(d)}.activity.jsonl`);

// ISO-8601 week number (Mon-based, week containing the year's first Thursday).
function isoWeekParts(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return { year: date.getUTCFullYear(), week };
}
function weeklyFile(d) {
  const { year, week } = isoWeekParts(d);
  return path.join(ROOT, `${year}-W${pad(week)}-weekly.md`);
}

// Derive a project tag from a working directory.
// Prefers the segment right after a "youleap" folder, else the cwd basename.
function projectFromCwd(cwd) {
  if (!cwd) return 'misc';
  const parts = String(cwd).replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean);
  const yi = parts.map((s) => s.toLowerCase()).lastIndexOf('youleap');
  if (yi >= 0 && parts[yi + 1]) return parts[yi + 1];
  return parts[parts.length - 1] || 'misc';
}

// Append one entry to today's daily file. Creates the file with a header if needed.
// Returns { file, line }.
function appendEntry({ project, message, time }) {
  ensureDirs();
  const d = now();
  const f = dailyFile(d);
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, `# ${dateKey(d)} (${hebDow(d)})\n\n`, 'utf8');
  }
  const t = time || timeKey(d);
  const clean = String(message).replace(/\s+/g, ' ').trim();
  const line = `- ${t} [${project}] ${clean}\n`;
  fs.appendFileSync(f, line, 'utf8');
  return { file: f, line };
}

function readIf(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

// ---- entry parsing -------------------------------------------------------
// One canonical, TOLERANT matcher for a logged entry line, shared by every parser (status, summary,
// calendar, session-end) so they can't drift. appendEntry writes `- HH:MM [project] message`, but a
// markdown formatter / editor-on-save may rewrite an existing daily file to `* HH:MM \[project] message`
// (asterisk bullet, backslash-escaped bracket) — so we accept `-` OR `*` bullets, optional leading
// whitespace, flexible inner spacing, and an optional backslash before each bracket. Without this, a
// single reformat silently zeroes the entry count and can make hasEntries() skip a whole day.
const ENTRY_RE_SRC = '^\\s*[-*]\\s+(\\d{2}:\\d{2})\\s+\\\\?\\[([^\\]]+?)\\\\?\\]\\s+(.+)$';
const entryRe = (flags) => new RegExp(ENTRY_RE_SRC, flags);
// Parse a single line → { time, project, message } or null.
function parseEntryLine(line) {
  const m = entryRe('').exec(String(line));
  return m ? { time: m[1], project: m[2], message: m[3] } : null;
}
// Does this text contain at least one entry line?
function hasEntryLine(text) { return entryRe('m').test(String(text || '')); }

// ---- update detection ----------------------------------------------------
// Content manifest of an artifact source folder, used to detect "is there something new to install"
// beyond a version bump (catches a same-version hotfix or a hand-patch). Scoped to exactly what the
// installer deploys + the version stamp: the `src/` tree and `VERSION`. Both the dev repo root and a
// built `work-journal-setup/` bundle have these at the same relative paths, so the hash is identical
// across machines and distribution forms when (and only when) the installable content matches.
// NOTE: deliberately excludes install.js/docs/dist — a release always bumps VERSION (which IS hashed),
// so any shipped change is reflected; only an unversioned installer-only edit would slip past, which
// never happens in distribution.
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function walkFiles(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// srcRoot = the folder that contains `src/` and `VERSION` (dev repo root, or a setup bundle).
function computeManifest(srcRoot) {
  const items = [];
  const srcDir = path.join(srcRoot, 'src');
  for (const f of walkFiles(srcDir)) {
    const rel = path.relative(srcRoot, f).replace(/\\/g, '/');
    items.push(rel + '\0' + sha256(fs.readFileSync(f)));
  }
  const vf = path.join(srcRoot, 'VERSION');
  if (fs.existsSync(vf)) items.push('VERSION\0' + sha256(fs.readFileSync(vf)));
  items.sort();
  return sha256(items.join('\n'));
}

// Append one per-prompt activity stamp to today's activity file. Tiny + append-only + content-free
// (project + time only). Created with the journal dirs if missing. Used by the UserPromptSubmit hook.
function appendActivity({ project }) {
  ensureDirs();
  const d = now();
  const f = activityFile(d);
  fs.appendFileSync(f, JSON.stringify({ t: timeKey(d), project: project || 'misc' }) + '\n', 'utf8');
  return f;
}

module.exports = {
  ROOT, SESSIONS, ensureDirs, now, pad,
  dateKey, timeKey, hebDow,
  dailyFile, summaryFile, weeklyFile, isoWeekParts, activityFile,
  projectFromCwd, appendEntry, appendActivity, readIf,
  sha256, computeManifest,
  entryRe, parseEntryLine, hasEntryLine,
};
