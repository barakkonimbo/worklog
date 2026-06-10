#!/usr/bin/env node
// worklog-remote.js — remote-source layer for /worklog update (v0.9.0).
//
// Keeps a small local CACHE clone of the distribution repo (the catalog) fresh, so `update` can pull
// the latest shipped bundle straight from GitHub — no manual "re-download the zip / pull the repo" step.
// worklog-update.js then runs its existing content-manifest comparison against the cache bundle.
//
// Auth: relies on the git credentials the user already has for the repo (the whole team already clones
// the catalog as part of normal work, so HTTPS creds are cached). We force NON-INTERACTIVE git
// (GIT_TERMINAL_PROMPT=0) so a machine without creds fails FAST instead of hanging on a prompt — the
// caller then degrades gracefully (notify "update available, run /worklog update" / use a local folder).
// No secrets are stored by us.
//
// The remote/branch are CONFIG-DRIVEN (config.json → update.remote / update.branch), so relocating the
// catalog to a GitHub org later is a one-line config change; on a changed remote we re-clone the cache.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./worklog-lib.js');

// Distribution repo = the team catalog (shipped artifacts only). Overridable via config.update.remote.
const DEFAULT_REMOTE = 'https://github.com/barakkonimbo/youleap-Implementers.git';
const DEFAULT_BRANCH = 'main';
const DEFAULT_BUNDLE = 'Features/work-journal-setup'; // path of the installable bundle inside the repo
const DEFAULT_CACHE = path.join(lib.ROOT, '.src-cache');

// Read update.* from config.json, with defaults. Never throws.
function gitConfig() {
  let u = {};
  try { u = (JSON.parse(fs.readFileSync(path.join(lib.ROOT, 'config.json'), 'utf8')).update) || {}; }
  catch { /* defaults */ }
  return {
    remote: u.remote || DEFAULT_REMOTE,
    branch: u.branch || DEFAULT_BRANCH,
    bundle: u.bundlePath || DEFAULT_BUNDLE,
    cacheDir: u.cacheDir || DEFAULT_CACHE,
    auto: !!u.auto,
  };
}

// Run git non-interactively (never prompts for credentials → fails fast on auth issues).
function git(args, opts = {}) {
  return spawnSync('git', args, {
    encoding: 'utf8', windowsHide: true, timeout: 120000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    ...opts,
  });
}

function hasGit() {
  try { return git(['--version']).status === 0; } catch { return false; }
}

// Clone (first time) or fetch+reset (subsequent) the cache to the tip of <remote>/<branch>.
// Shallow single-branch — small and fast. FAIL-SAFE: returns { ok, reason, detail, bundlePath, head };
// never throws, never prompts. ok:false means the caller should fall back (local folder / notify).
function refreshCache(cfg) {
  cfg = cfg || gitConfig();
  if (!hasGit()) return { ok: false, reason: 'no-git' };
  const { remote, branch, cacheDir, bundle } = cfg;
  try {
    let needClone = !fs.existsSync(path.join(cacheDir, '.git'));
    if (!needClone) {
      // If the configured remote changed (e.g. catalog moved to an org), re-clone rather than fetch.
      const cur = (git(['-C', cacheDir, 'remote', 'get-url', 'origin']).stdout || '').trim();
      if (cur !== remote) needClone = true;
    }
    if (needClone) {
      if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
      const r = git(['clone', '--depth', '1', '--single-branch', '--branch', branch, remote, cacheDir]);
      if (r.status !== 0) return { ok: false, reason: 'clone-failed', detail: (r.stderr || '').trim().slice(0, 300) };
    } else {
      const f = git(['-C', cacheDir, 'fetch', '--depth', '1', 'origin', branch]);
      if (f.status !== 0) return { ok: false, reason: 'fetch-failed', detail: (f.stderr || '').trim().slice(0, 300) };
      const rs = git(['-C', cacheDir, 'reset', '--hard', 'FETCH_HEAD']);
      if (rs.status !== 0) return { ok: false, reason: 'reset-failed', detail: (rs.stderr || '').trim().slice(0, 300) };
    }
  } catch (e) {
    return { ok: false, reason: 'exception', detail: e.message };
  }
  const bundlePath = path.join(cacheDir, bundle);
  if (!fs.existsSync(path.join(bundlePath, 'install.js')) || !fs.existsSync(path.join(bundlePath, 'src'))) {
    return { ok: false, reason: 'bundle-missing', detail: bundle, bundlePath };
  }
  const head = (git(['-C', cacheDir, 'rev-parse', '--short', 'HEAD']).stdout || '').trim();
  return { ok: true, bundlePath, head };
}

module.exports = { refreshCache, gitConfig, hasGit, DEFAULT_REMOTE, DEFAULT_BRANCH, DEFAULT_BUNDLE };

// CLI: `node worklog-remote.js` prints a one-line status of the cache refresh (handy for debugging).
if (require.main === module) {
  const info = refreshCache();
  console.log(info.ok ? ('cache fresh @ ' + info.head + ' → ' + info.bundlePath) : ('refresh failed: ' + info.reason + (info.detail ? ' (' + info.detail + ')' : '')));
  process.exit(info.ok ? 0 : 1);
}
