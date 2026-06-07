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
const { spawnSync } = require('child_process');
const fmt = require('./worklog-format.js');

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
      "Send-MailMessage -From $env:WL_FROM -To ($env:WL_TO -split ',') -Subject $env:WL_SUBJ -Body $env:WL_BODY -BodyAsHtml -SmtpServer $env:WL_HOST -Port ([int]$env:WL_PORT) -UseSsl -Credential $cred -Encoding UTF8",
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
        WL_BODY: fmt.toHtml(body || ''),
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
// Every prompt runs inside ONE PowerShell invocation, on purpose:
//  - prompts are in English, so they don't render reversed in the Windows console (Hebrew BiDi bug);
//  - a single stdin reader avoids the Node-readline ↔ PowerShell-Read-Host race that hid the password
//    prompt until an extra Enter. PowerShell collects the fields, encrypts the password (DPAPI), and
//    hands the non-secret fields back to Node via a temp JSON file.
function setup() {
  if (process.platform !== 'win32') { console.error('Email setup is Windows-first (DPAPI).'); process.exit(1); }
  console.log('Work Journal — email setup (Gmail).');
  console.log('You need a Google App Password (Google Account > Security > App passwords).\n');
  fs.mkdirSync(ROOT, { recursive: true });
  const CFG_TMP = path.join(ROOT, '.email-setup.json');
  try { fs.unlinkSync(CFG_TMP); } catch { /* none */ }

  const ps = [
    "$ErrorActionPreference='Stop'",
    "$to = Read-Host 'Email address to receive the summary'",
    "if ([string]::IsNullOrWhiteSpace($to)) { Write-Error 'Address is required.'; exit 1 }",
    "$from = Read-Host \"Sender Gmail address (press Enter to use $to)\"",
    "if ([string]::IsNullOrWhiteSpace($from)) { $from = $to }",
    "$smtp = Read-Host 'SMTP host (press Enter for smtp.gmail.com)'",
    "if ([string]::IsNullOrWhiteSpace($smtp)) { $smtp = 'smtp.gmail.com' }",
    "$port = Read-Host 'SMTP port (press Enter for 587)'",
    "if ([string]::IsNullOrWhiteSpace($port)) { $port = '587' }",
    "$pw = Read-Host -AsSecureString 'Gmail App Password (input is hidden)'",
    "if ($pw.Length -eq 0) { Write-Error 'Password is empty.'; exit 1 }",
    "ConvertFrom-SecureString $pw | Set-Content -NoNewline -Path $env:WL_CRED -Encoding ASCII",
    "@{ to=$to; from=$from; smtpHost=$smtp; smtpPort=[int]$port } | ConvertTo-Json -Compress | Set-Content -NoNewline -Path $env:WL_CFG -Encoding UTF8",
  ].join('; ');
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit', env: { ...process.env, WL_CRED: CRED, WL_CFG: CFG_TMP } });
  if (r.status !== 0 || !fs.existsSync(CRED) || !fs.existsSync(CFG_TMP)) { console.error('\nSetup cancelled or failed.'); process.exit(1); }

  let f;
  try { f = JSON.parse(fs.readFileSync(CFG_TMP, 'utf8')); }
  catch { console.error('\nSetup failed to read the entered fields.'); process.exit(1); }
  finally { try { fs.unlinkSync(CFG_TMP); } catch { /* ignore */ } }

  const schedule = require('./worklog-schedule.js');
  const d = schedule.defaultConfig();
  const c = readConfig();
  c.email = { ...d.email, ...(c.email || {}), enabled: true, provider: 'gmail', to: f.to, from: f.from || f.to, smtpHost: f.smtpHost || 'smtp.gmail.com', smtpPort: Number(f.smtpPort) || 587 };
  c.weekly = { ...d.weekly, ...(c.weekly || {}) };
  writeConfig(c);
  // (re)register tasks so the daily email (20:30) + weekly recap start working immediately
  try { schedule.registerTasks({ node: process.execPath, summaryScript: path.join(__dirname, 'worklog-summary.js'), config: c }); } catch { /* non-fatal */ }
  console.log('\nSaved (App Password DPAPI-encrypted) and tasks updated. Test:  node "' + __filename.replace(/\\/g, '/') + '" --test');
}

function test() {
  if (!emailEnabled()) { console.error('Email not configured — run --setup first.'); process.exit(1); }
  const ok = sendSummary('בדיקת Work Journal ✅', 'אם קיבלת את המייל הזה — שליחת המייל מוגדרת ועובדת. 🎉');
  console.log(ok ? 'Sent — check your inbox.' : 'Failed — check address / password / connection.');
}

module.exports = { sendSummary, emailEnabled };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--setup')) setup();
  else if (a.includes('--test')) test();
  else if (a.includes('--disable')) { const c = readConfig(); if (c.email) { c.email.enabled = false; writeConfig(c); } console.log('Email disabled.'); }
  else console.log('usage: worklog-email.js --setup | --test | --disable');
}
