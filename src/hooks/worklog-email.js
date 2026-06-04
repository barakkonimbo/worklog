#!/usr/bin/env node
/*
 * worklog-email.js — OPTIONAL email delivery of summaries (off by default).
 *
 *   node worklog-email.js --setup    interactive one-time config (address + app password)
 *   node worklog-email.js --test     send a test email with the saved config
 *   require('./worklog-email').sendSummary(subject, bodyMarkdown)  -> boolean
 *   require('./worklog-email').emailEnabled()                      -> boolean
 *
 * Storage (under ~/.claude/work-journal/):
 *   config.json   — { email: { enabled, provider, to, from, smtpHost, smtpPort } }   (NO password)
 *   .email-cred   — the app password, DPAPI-encrypted per Windows user (never plaintext)
 *
 * Sending uses PowerShell Send-MailMessage over STARTTLS; the password is decrypted
 * from DPAPI at send time. Windows-first; no external npm/PowerShell modules.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, 'work-journal')
  : path.join(os.homedir(), '.claude', 'work-journal');
const CONFIG = path.join(ROOT, 'config.json');
const CRED = path.join(ROOT, '.email-cred');

function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } }
function writeConfig(c) { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n', 'utf8'); }

function emailEnabled() {
  const c = readConfig();
  return !!(c.email && c.email.enabled && c.email.to && fs.existsSync(CRED));
}

// Send a summary by email. Returns true on success, false otherwise. Never throws.
function sendSummary(subject, body) {
  try {
    if (!emailEnabled()) return false;
    if (process.platform !== 'win32') { console.error('[worklog-email] sending implemented for Windows first'); return false; }
    const e = readConfig().email;
    const ps = [
      "$ErrorActionPreference='Stop'",
      "$enc=Get-Content -Raw $env:WL_CRED",
      "$sec=ConvertTo-SecureString $enc",
      "$cred=New-Object System.Management.Automation.PSCredential($env:WL_FROM,$sec)",
      "Send-MailMessage -From $env:WL_FROM -To ($env:WL_TO -split ',') -Subject $env:WL_SUBJ -Body $env:WL_BODY -SmtpServer $env:WL_HOST -Port ([int]$env:WL_PORT) -UseSsl -Credential $cred -Encoding UTF8",
      "Write-Output 'sent'",
    ].join('; ');
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8', windowsHide: true, timeout: 60000,
      env: {
        ...process.env,
        WL_CRED: CRED,
        WL_FROM: e.from || e.to,
        WL_TO: e.to,
        WL_SUBJ: subject || 'Work Journal',
        WL_BODY: body || '',
        WL_HOST: e.smtpHost || 'smtp.gmail.com',
        WL_PORT: String(e.smtpPort || 587),
      },
    });
    if (r.status === 0) { console.log('[worklog-email] sent to', e.to); return true; }
    console.error('[worklog-email] send failed:', (r.stderr || r.stdout || '').trim().slice(0, 600));
    return false;
  } catch (err) { console.error('[worklog-email]', err.message); return false; }
}

// --- interactive setup (run in a real terminal) ---
async function setup() {
  console.log('— הגדרת מייל ל-Work Journal (Gmail) —');
  console.log('דרוש App Password מחשבון Google (Account > Security > App passwords). הריצו ב-PowerShell/cmd.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, d) => new Promise((res) => rl.question(q + (d ? ` [${d}]` : '') + ': ', (a) => res((a || '').trim() || d || '')));
  const to = await ask('כתובת לקבלת הסיכום');
  if (!to) { console.error('חובה כתובת. בוטל.'); rl.close(); process.exit(1); }
  const from = await ask('כתובת השולח (Gmail)', to);
  const host = await ask('SMTP host', 'smtp.gmail.com');
  const port = await ask('SMTP port', '587');
  rl.close();

  // hidden password prompt + DPAPI encrypt, in the same console
  fs.mkdirSync(ROOT, { recursive: true });
  const ps = "$p=Read-Host -AsSecureString 'App Password (לא יוצג בהקלדה)'; if($p.Length -eq 0){ Write-Error 'empty'; exit 1 }; ConvertFrom-SecureString $p | Set-Content -NoNewline -Path $env:WL_CRED -Encoding ASCII";
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit', env: { ...process.env, WL_CRED: CRED } });
  if (r.status !== 0 || !fs.existsSync(CRED)) { console.error('\nשמירת הסיסמה נכשלה. בוטל.'); process.exit(1); }

  const schedule = require('./worklog-schedule.js');
  const d = schedule.defaultConfig();
  const c = readConfig();
  c.email = { ...d.email, ...(c.email || {}), enabled: true, provider: 'gmail', to, from, smtpHost: host, smtpPort: Number(port) };
  c.weekly = { ...d.weekly, ...(c.weekly || {}) };
  writeConfig(c);
  // (re)register tasks so the daily email (20:30) + weekly recap start working immediately
  try { schedule.registerTasks({ node: process.execPath, summaryScript: path.join(__dirname, 'worklog-summary.js'), config: c }); } catch { /* non-fatal */ }
  console.log('\n✅ נשמר (סיסמה מוצפנת DPAPI) והמשימות עודכנו. בדיקה:  node "' + __filename.replace(/\\/g, '/') + '" --test');
}

function test() {
  if (!emailEnabled()) { console.error('מייל לא מוגדר. הריצו קודם --setup'); process.exit(1); }
  const ok = sendSummary('בדיקת Work Journal ✅', 'אם קיבלת את המייל הזה — שליחת המייל מוגדרת ועובדת. 🎉');
  console.log(ok ? 'נשלח — בדוק את תיבת הדואר.' : 'נכשל — בדוק כתובת/סיסמה/חיבור.');
}

module.exports = { sendSummary, emailEnabled };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--setup')) setup();
  else if (a.includes('--test')) test();
  else if (a.includes('--disable')) { const c = readConfig(); if (c.email) { c.email.enabled = false; writeConfig(c); } console.log('מייל כובה.'); }
  else console.log('usage: worklog-email.js --setup | --test | --disable');
}
