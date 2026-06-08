#!/usr/bin/env node
/*
 * worklog-calendar.js — OPTIONAL Google Calendar sync of the work-journal (off by default).
 *
 *   node worklog-calendar.js --setup [--env <path>]   one-time OAuth (loopback) + create calendar
 *   node worklog-calendar.js --test                    create a tagged test event, then delete it
 *   node worklog-calendar.js --sync [YYYY-MM-DD]       sync a day's blocks + summary event (idempotent)
 *   node worklog-calendar.js --disable                 turn calendar off (keeps saved token)
 *
 * Storage (under ~/.claude/work-journal/):
 *   config.json     — { calendar: { enabled, calendarId, summaryEvent, minBlockMinutes, maxGapMinutes } }
 *   .calendar-cred  — { client_id, client_secret, refresh_token }, DPAPI-encrypted per Windows user
 *
 * Safety (per CALENDAR-SPEC.md): writes ONLY to a dedicated "Work Journal" calendar, and only
 * touches events tagged extendedProperties.private.worklog=<date> — never the user's real events.
 * Windows-first (DPAPI); no external npm modules.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const readline = require('readline');
const { spawnSync, execSync } = require('child_process');
const lib = require('./worklog-lib.js');
const { computeBlocks } = require('./worklog-blocks.js');
const fmt = require('./worklog-format.js');

const ROOT = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, 'work-journal')
  : path.join(os.homedir(), '.claude', 'work-journal');
const CONFIG = path.join(ROOT, 'config.json');
const CRED = path.join(ROOT, '.calendar-cred');

const OAUTH_PORT = 18273;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();

// ---------- config ----------
function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } }
function writeConfig(c) { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n', 'utf8'); }
function calendarEnabled() { const c = readConfig(); return !!(c.calendar && c.calendar.enabled && c.calendar.calendarId && fs.existsSync(CRED)); }

// ---------- DPAPI cred storage (Windows) ----------
function dpapiEncrypt(plain, file) {
  const ps = "$s=$env:WL_PLAIN; ConvertTo-SecureString $s -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -NoNewline -Path $env:WL_FILE -Encoding ASCII";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
    { encoding: 'utf8', windowsHide: true, env: { ...process.env, WL_PLAIN: plain, WL_FILE: file } });
  return r.status === 0;
}
function dpapiDecrypt(file) {
  const ps = "$enc=Get-Content -Raw $env:WL_FILE; $sec=ConvertTo-SecureString $enc; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec); try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
    { encoding: 'utf8', windowsHide: true, env: { ...process.env, WL_FILE: file } });
  return r.status === 0 ? (r.stdout || '').trim() : null;
}
function saveCred(obj) { fs.mkdirSync(ROOT, { recursive: true }); return dpapiEncrypt(JSON.stringify(obj), CRED); }
function loadCred() { if (!fs.existsSync(CRED)) return null; try { return JSON.parse(dpapiDecrypt(CRED) || ''); } catch { return null; } }

// ---------- HTTPS JSON helper ----------
function httpsJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let j = {};
        try { j = data ? JSON.parse(data) : {}; } catch { j = { raw: data }; }
        if (res.statusCode >= 400 || j.error) {
          const msg = (j.error && (j.error.message || j.error_description || j.error)) || `HTTP ${res.statusCode}`;
          return reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
        }
        resolve(j);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- OAuth2 ----------
function form(obj) { return Object.entries(obj).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); }

async function tokenRequest(params) {
  return httpsJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(params),
  });
}

async function getAccessToken() {
  const cred = loadCred();
  if (!cred || !cred.refresh_token) throw new Error('Calendar not set up (no saved token). Run --setup.');
  const j = await tokenRequest({
    client_id: cred.client_id, client_secret: cred.client_secret,
    refresh_token: cred.refresh_token, grant_type: 'refresh_token',
  });
  return j.access_token;
}

// Loopback consent flow → returns refresh_token. Opens the browser; waits for the redirect.
function loopbackConsent(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + form({
      client_id: clientId, redirect_uri: REDIRECT_URI, response_type: 'code',
      scope: SCOPE, access_type: 'offline', prompt: 'consent',
    });
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url, REDIRECT_URI);
        const code = u.searchParams.get('code');
        const err = u.searchParams.get('error');
        if (err) { res.end('Consent failed: ' + err); server.close(); return reject(new Error(err)); }
        if (!code) { res.statusCode = 400; res.end('no code'); return; }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<h2>✅ Work Journal — חיבור היומן הושלם</h2><p>אפשר לסגור את החלון ולחזור לטרמינל.</p>');
        server.close();
        const j = await tokenRequest({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
        });
        if (!j.refresh_token) return reject(new Error('No refresh_token returned (try removing the app under myaccount.google.com/permissions and retry).'));
        resolve(j.refresh_token);
      } catch (e) { reject(e); }
    });
    server.on('error', reject);
    server.listen(OAUTH_PORT, () => {
      console.log('🔐 Opening browser for calendar consent… (if it does not open, open this URL manually:)');
      console.log(authUrl + '\n');
      const cmd = process.platform === 'win32' ? `start "" "${authUrl}"`
        : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
      try { execSync(cmd, { stdio: 'ignore' }); } catch { /* user opens manually */ }
    });
    setTimeout(() => { try { server.close(); } catch {} reject(new Error('Timed out waiting for consent (180s).')); }, 180000);
  });
}

// ---------- Calendar REST ----------
async function findOrCreateCalendar(token) {
  const list = await httpsJson('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
    { headers: { Authorization: `Bearer ${token}` } });
  const found = (list.items || []).find((c) => c.summary === 'Work Journal');
  if (found) return found.id;
  const created = await httpsJson('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Work Journal', description: 'Auto-logged work blocks + daily summary (Work Journal)', timeZone: TZ }),
  });
  return created.id;
}

async function listTaggedEvents(token, calId, dateStr) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?maxResults=2500&privateExtendedProperty=${encodeURIComponent('worklog=' + dateStr)}`;
  const j = await httpsJson(url, { headers: { Authorization: `Bearer ${token}` } });
  return j.items || [];
}
async function createEvent(token, calId, ev) {
  return httpsJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(ev),
  });
}
function deleteEvent(token, calId, eventId) {
  return new Promise((resolve) => {
    const req = https.request(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
    req.on('error', resolve); // best-effort delete
    req.end();
  });
}

// ---------- day data ----------
function parseEntries(md) {
  const out = [];
  for (const ln of (md || '').split('\n')) {
    const e = lib.parseEntryLine(ln);
    if (e) out.push({ time: e.time, project: e.project, msg: e.message });
  }
  return out;
}
function parseSessions(dateStr) {
  const f = path.join(lib.SESSIONS, dateStr + '.jsonl');
  const out = [];
  for (const ln of (lib.readIf(f) || '').split('\n')) {
    if (!ln.trim()) continue;
    try { const o = JSON.parse(ln); if (o.start && o.end) out.push(o); } catch { /* skip */ }
  }
  return out;
}
// Dense per-prompt activity stamps for a day (content-free heartbeats) — the primary source for blocks.
function parseActivity(dateStr) {
  const f = path.join(lib.SESSIONS, dateStr + '.activity.jsonl');
  const out = [];
  for (const ln of (lib.readIf(f) || '').split('\n')) {
    if (!ln.trim()) continue;
    try { const o = JSON.parse(ln); if (o.t) out.push({ time: o.t, project: o.project || 'misc' }); } catch { /* skip */ }
  }
  return out;
}
function dateObjOf(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); }
function nextDateStr(dateStr) { const d = dateObjOf(dateStr); d.setDate(d.getDate() + 1); return lib.dateKey(d); }

// ---------- sync a day ----------
async function syncDay(dateStr, opts = {}) {
  const cfg = readConfig();
  const cal = cfg.calendar || {};
  // Default target = the dedicated "Work Journal" calendar; a push passes opts.calId (e.g. 'primary').
  const calId = opts.calId || cal.calendarId;
  if (!cal.enabled || !calId || !fs.existsSync(CRED)) return { skipped: 'not-enabled' };
  if (process.platform !== 'win32') return { skipped: 'not-windows' };

  const token = await getAccessToken();
  const dObj = dateObjOf(dateStr);

  const entries = parseEntries(lib.readIf(lib.dailyFile(dObj)));
  const sessions = parseSessions(dateStr);
  const activity = parseActivity(dateStr);
  const blocks = computeBlocks(sessions, entries, {
    maxGap: cal.maxGapMinutes || 90,
    minBlock: cal.minBlockMinutes || 15,
    activityGap: cal.activityGapMinutes || 30,   // split a day's stamps into blocks at gaps > this
    tail: cal.tailMinutes != null ? cal.tailMinutes : 10, // extend each block past its last stamp
    activity,
  });

  const events = blocks.map((b) => ({
    summary: b.project,
    description: (b.notes || []).join('\n'),
    start: { dateTime: `${dateStr}T${b.start}:00`, timeZone: TZ },
    end: { dateTime: `${dateStr}T${b.end}:00`, timeZone: TZ },
    extendedProperties: { private: { worklog: dateStr } },
  }));

  if (cal.summaryEvent !== false) {
    const sum = lib.readIf(lib.summaryFile(dObj)).trim();
    if (sum) events.push({
      summary: '📓 סיכום היום',
      description: fmt.toCalHtml(sum).slice(0, 8000),
      start: { date: dateStr }, end: { date: nextDateStr(dateStr) },
      extendedProperties: { private: { worklog: dateStr } },
    });
  }

  // idempotent replace: delete our prior events for this date, then recreate
  const prior = await listTaggedEvents(token, calId, dateStr);
  for (const ev of prior) await deleteEvent(token, calId, ev.id);
  for (const ev of events) await createEvent(token, calId, ev);
  return { blocks: blocks.length, events: events.length, replaced: prior.length };
}

// ---------- push: full mirror of a day to ANOTHER calendar (e.g. the user's primary) ----------
// `push` reuses syncDay against pushCalendarId — a full 1:1 mirror (same blocks + summary, no filtering).
// It NEVER replaces the private "Work Journal" calendar; it only ALSO copies the day elsewhere.
// Idempotent on the target (same worklog=<date> tag → delete-then-recreate). Token already has full scope.
function pushTarget(cfg) { return (cfg.calendar && cfg.calendar.pushCalendarId) || 'primary'; }
function autoPushEnabled() { const c = readConfig(); return !!(c.calendar && c.calendar.enabled && c.calendar.autoPush && fs.existsSync(CRED)); }

// Remove this day's worklog-tagged events from a calendar (the `unpush` / retract op). No re-insert.
async function clearDay(dateStr, calId) {
  const cfg = readConfig();
  if (!cfg.calendar || !cfg.calendar.enabled || !fs.existsSync(CRED)) return { skipped: 'not-enabled' };
  if (process.platform !== 'win32') return { skipped: 'not-windows' };
  const token = await getAccessToken();
  const prior = await listTaggedEvents(token, calId, dateStr);
  for (const ev of prior) await deleteEvent(token, calId, ev.id);
  return { removed: prior.length };
}

async function listCalendars(token) {
  const j = await httpsJson('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
    { headers: { Authorization: `Bearer ${token}` } });
  return (j.items || []).map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary }));
}

// ---------- resolve client id/secret for --setup ----------
function readEnvFile(p) {
  const out = {};
  try {
    for (const ln of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(ln);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch { /* none */ }
  return out;
}
async function resolveClientCreds(envPath) {
  let id = process.env.CALENDAR_CLIENT_ID, secret = process.env.CALENDAR_CLIENT_SECRET;
  const candidates = [envPath, path.join(process.cwd(), '.env')].filter(Boolean);
  for (const c of candidates) {
    if (id && secret) break;
    const e = readEnvFile(c);
    id = id || e.CALENDAR_CLIENT_ID; secret = secret || e.CALENDAR_CLIENT_SECRET;
  }
  if (id && secret) return { id, secret };
  // fall back to interactive prompt (desktop-client secret is low-sensitivity)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, (a) => r((a || '').trim())));
  id = id || await ask('Client ID: ');
  secret = secret || await ask('Client Secret: ');
  rl.close();
  return { id, secret };
}

// ---------- commands ----------
async function handleSetup(argv) {
  if (process.platform !== 'win32') { console.error('Calendar setup is Windows-first (DPAPI).'); process.exit(1); }
  const ei = argv.indexOf('--env');
  const envPath = ei >= 0 ? argv[ei + 1] : null;
  const { id, secret } = await resolveClientCreds(envPath);
  if (!id || !secret) { console.error('Missing Client ID / Secret. Cancelled.'); process.exit(1); }

  const refresh = await loopbackConsent(id, secret);
  if (!saveCred({ client_id: id, client_secret: secret, refresh_token: refresh })) {
    console.error('Saving the token (DPAPI) failed.'); process.exit(1);
  }
  const token = await getAccessToken();
  const calId = await findOrCreateCalendar(token);

  const schedule = require('./worklog-schedule.js');
  const d = schedule.defaultConfig();
  const c = readConfig();
  c.calendar = { ...d.calendar, ...(c.calendar || {}), enabled: true, calendarId: calId };
  writeConfig(c);
  console.log('\n✅ Calendar connected (token DPAPI-encrypted). Target calendar: "Work Journal".');
  console.log('Test:  node "' + __filename.replace(/\\/g, '/') + '" --test');
}

async function handleTest() {
  if (!calendarEnabled()) { console.error('Calendar not configured — run --setup first.'); process.exit(1); }
  const cfg = readConfig();
  const token = await getAccessToken();
  const today = lib.dateKey(lib.now());
  const start = new Date(); const end = new Date(start.getTime() + 30 * 60000);
  const ev = await createEvent(token, cfg.calendar.calendarId, {
    summary: '🧪 Work Journal — test',
    start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
    extendedProperties: { private: { worklog: today } },
  });
  console.log('✅ Test event created in the "Work Journal" calendar. Deleting in 4 seconds…');
  setTimeout(async () => {
    try { await deleteEvent(token, cfg.calendar.calendarId, ev.id); console.log('✅ Test event deleted. Everything works.'); }
    catch (e) { console.error('Delete failed (you can remove it manually):', e.message); }
  }, 4000);
}

async function handleSync(argv) {
  const dateStr = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || lib.dateKey(lib.now());
  const r = await syncDay(dateStr);
  if (r.skipped) { console.log('[worklog-calendar] skipped:', r.skipped); return; }
  console.log(`[worklog-calendar] synced ${dateStr}: ${r.events} events (${r.blocks} blocks), replaced ${r.replaced}`);
}

async function handlePush(argv) {
  if (!calendarEnabled()) { console.error('Calendar not configured — run --setup first.'); process.exit(1); }
  const dateStr = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || lib.dateKey(lib.now());
  const calId = pushTarget(readConfig());
  const r = await syncDay(dateStr, { calId });
  if (r.skipped) { console.log('[worklog-calendar] push skipped:', r.skipped); return; }
  console.log(`[worklog-calendar] pushed ${dateStr} → ${calId}: ${r.events} events (${r.blocks} blocks), replaced ${r.replaced}`);
}

async function handleUnpush(argv) {
  if (!calendarEnabled()) { console.error('Calendar not configured — run --setup first.'); process.exit(1); }
  const dateStr = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || lib.dateKey(lib.now());
  const calId = pushTarget(readConfig());
  const r = await clearDay(dateStr, calId);
  if (r.skipped) { console.log('[worklog-calendar] unpush skipped:', r.skipped); return; }
  console.log(`[worklog-calendar] unpushed ${dateStr} from ${calId}: removed ${r.removed}`);
}

// Non-interactive list — used by the /worklog skill so Claude can show the calendars and the user picks.
async function handleListCalendars() {
  if (!calendarEnabled()) { console.error('Calendar not configured — run --setup first.'); process.exit(1); }
  const token = await getAccessToken();
  const cals = await listCalendars(token);
  const cur = pushTarget(readConfig());
  console.log('Your calendars (current push target = ' + cur + '):');
  cals.forEach((c, i) => console.log(`  ${i + 1}. ${c.summary}${c.primary ? '  (primary)' : ''}   [${c.id}]`));
}

// Interactive picker (real terminal): list calendars, pick one, optionally enable the auto end-of-day mirror.
async function handlePushSetup() {
  if (!calendarEnabled()) { console.error('Calendar not configured — run --setup first.'); process.exit(1); }
  const token = await getAccessToken();
  const cals = await listCalendars(token);
  console.log('\nWork Journal — choose the calendar to mirror your day to:');
  cals.forEach((c, i) => console.log(`  ${i + 1}. ${c.summary}${c.primary ? '  (primary)' : ''}`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  const pick = parseInt((await ask('\nNumber [default 1 = primary]: ')).trim(), 10);
  const idx = Number.isFinite(pick) ? Math.max(1, Math.min(cals.length, pick)) - 1 : 0;
  const chosen = cals[idx] || cals.find((c) => c.primary) || cals[0];
  const autoAns = (await ask('Also mirror automatically at end of day? (y/N): ')).trim().toLowerCase();
  rl.close();
  const schedule = require('./worklog-schedule.js');
  const d = schedule.defaultConfig();
  const c = readConfig();
  c.calendar = { ...d.calendar, ...(c.calendar || {}) };
  c.calendar.pushCalendarId = chosen.primary ? 'primary' : chosen.id;
  c.calendar.autoPush = /^y(es)?$/.test(autoAns);
  writeConfig(c);
  console.log(`\n✅ Push target: "${chosen.summary}". Auto end-of-day mirror: ${c.calendar.autoPush ? 'ON' : 'OFF'}.`);
  console.log('Note: this does NOT replace your private "Work Journal" calendar — it only ALSO mirrors the day there.');
}

module.exports = { syncDay, calendarEnabled, autoPushEnabled };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const run = argv.includes('--setup') ? handleSetup(argv)
    : argv.includes('--test') ? handleTest()
    : argv.includes('--sync') ? handleSync(argv)
    : argv.includes('--push') ? handlePush(argv)
    : argv.includes('--unpush') ? handleUnpush(argv)
    : argv.includes('--push-setup') ? handlePushSetup()
    : argv.includes('--list-calendars') ? handleListCalendars()
    : argv.includes('--disable') ? (() => { const c = readConfig(); if (c.calendar) { c.calendar.enabled = false; writeConfig(c); } console.log('Calendar disabled.'); })()
    : Promise.resolve(console.log('usage: worklog-calendar.js --setup [--env <path>] | --test | --sync [YYYY-MM-DD] | --push [DATE] | --unpush [DATE] | --push-setup | --list-calendars | --disable'));
  Promise.resolve(run).catch((e) => { console.error('[worklog-calendar] error:', e.message); process.exit(1); });
}
