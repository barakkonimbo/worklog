#!/usr/bin/env node
/*
 * build.js — assemble the distributable setup-skill from canonical source.
 *
 *   node build.js
 *
 * Produces:
 *   dist/work-journal-setup/        a self-contained skill folder (SKILL.md + installer + src/)
 *   dist/work-journal-setup.zip     zipped for sharing (Windows; via Compress-Archive)
 *
 * A teammate drops `work-journal-setup/` into their ~/.claude/skills/ and runs
 * `/work-journal-setup` once. The bundled install.js finds its source at ./src.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist', 'work-journal-setup');
const fwd = (p) => String(p).replace(/\\/g, '/');

// clean
fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// SKILL.md + human-facing instructions + installer scripts
fs.copyFileSync(path.join(ROOT, 'install', 'SKILL.md'), path.join(OUT, 'SKILL.md'));
fs.copyFileSync(path.join(ROOT, 'install', 'INSTALL.md'), path.join(OUT, 'INSTALL.md'));
fs.copyFileSync(path.join(ROOT, 'install', 'install.js'), path.join(OUT, 'install.js'));
fs.copyFileSync(path.join(ROOT, 'install', 'uninstall.js'), path.join(OUT, 'uninstall.js'));
fs.copyFileSync(path.join(ROOT, 'VERSION'), path.join(OUT, 'VERSION'));
fs.copyFileSync(path.join(ROOT, 'upgrade-notes.json'), path.join(OUT, 'upgrade-notes.json'));

// bundle source (install.js resolves ./src when bundled)
fs.cpSync(path.join(ROOT, 'src'), path.join(OUT, 'src'), { recursive: true });

console.log('Built skill folder: ' + fwd(OUT));
for (const f of walk(OUT)) console.log('  ' + fwd(path.relative(OUT, f)));

// zip on Windows
if (process.platform === 'win32') {
  const zip = path.join(ROOT, 'dist', 'work-journal-setup.zip');
  const ps = "Compress-Archive -Path '" + OUT.replace(/'/g, "''") + "' -DestinationPath '" + zip.replace(/'/g, "''") + "' -Force";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  if (r.status === 0) console.log('\nZipped -> ' + fwd(zip));
  else console.error('\nzip failed: ' + ((r.stderr || '').trim().slice(0, 300)));
} else {
  console.log('\n(zip step is Windows-only; on macOS/Linux: zip -r work-journal-setup.zip work-journal-setup)');
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
