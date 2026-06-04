#!/usr/bin/env node
/*
 * worklog-notify.js — fire a dependency-free desktop notification.
 *
 *   node worklog-notify.js "title" "message"
 *   require('./worklog-notify').notify(title, message)
 *
 * Windows: native toast via WinRT (no module needed).
 * macOS:   osascript.    Linux: notify-send (if present).
 * Always fail-safe: never throws, so it can't break summary generation.
 * Disable globally with env WORKLOG_NO_NOTIFY=1.
 */

const { spawnSync } = require('child_process');

function notify(title, message, launchPath) {
  if (process.env.WORKLOG_NO_NOTIFY === '1') return;
  try {
    if (process.platform === 'win32') winToast(title, message, launchPath);
    else if (process.platform === 'darwin') macNotify(title, message);
    else linuxNotify(title, message);
  } catch { /* notifications are best-effort; never break the caller */ }
}

function winToast(title, message, launchPath) {
  // WinRT toast using PowerShell's registered AppUserModelID (no install/module required).
  // All non-ASCII / user content is passed via env and XML-escaped inside PowerShell.
  // When launchPath is given, clicking the toast (or "פתח סיכום") opens it via protocol
  // activation, and "פתח תיקייה" opens its folder. No COM registration needed.
  const fileUri = (p) => (p ? 'file:///' + encodeURI(String(p).replace(/\\/g, '/')) : '');
  const launch = fileUri(launchPath);
  const dir = launch ? launch.replace(/\/[^/]*$/, '/') : '';
  const ps = [
    "[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]|Out-Null",
    "$AppId='{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
    "$t=[System.Security.SecurityElement]::Escape($env:WL_TITLE)",
    "$m=[System.Security.SecurityElement]::Escape($env:WL_MSG)",
    "$ln=$env:WL_LAUNCH; $attr=''; $act=''",
    "if($ln){ $l=[System.Security.SecurityElement]::Escape($ln); $d=[System.Security.SecurityElement]::Escape($env:WL_DIR); $b1=[System.Security.SecurityElement]::Escape($env:WL_BTN1); $b2=[System.Security.SecurityElement]::Escape($env:WL_BTN2); $attr=\" activationType='protocol' launch='$l'\"; $act=\"<actions><action content='$b1' activationType='protocol' arguments='$l'/><action content='$b2' activationType='protocol' arguments='$d'/></actions>\" }",
    "$x=New-Object Windows.Data.Xml.Dom.XmlDocument",
    "$x.LoadXml(\"<toast$attr><visual><binding template='ToastGeneric'><text>$t</text><text>$m</text></binding></visual>$act</toast>\")",
    "$toast=New-Object Windows.UI.Notifications.ToastNotification $x",
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)",
  ].join('; ');
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
    env: {
      ...process.env,
      WL_TITLE: String(title || 'Work Journal'),
      WL_MSG: String(message || ''),
      WL_LAUNCH: launch,
      WL_DIR: dir,
      WL_BTN1: 'פתח סיכום',
      WL_BTN2: 'פתח תיקייה',
    },
  });
}

function macNotify(title, message) {
  const esc = (s) => String(s || '').replace(/"/g, '\\"');
  spawnSync('osascript', ['-e', `display notification "${esc(message)}" with title "${esc(title)}"`], { timeout: 15000 });
}

function linuxNotify(title, message) {
  spawnSync('notify-send', [String(title || 'Work Journal'), String(message || '')], { timeout: 15000 });
}

module.exports = { notify };

if (require.main === module) notify(process.argv[2] || 'Work Journal', process.argv[3] || '', process.argv[4] || '');
