#!/usr/bin/env node
/**
 * nio installer
 * Run from your project root after installing the package:
 *   npx nio install
 *
 * What it does:
 *  1. Copies config files to project root (skips if already present)
 *  2. Copies hook templates to .husky/ (skips if already present)
 *  3. Adds npm scripts to package.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root = wherever npm was run from (cwd), not the package directory
const PROJECT_ROOT = process.cwd();
const NIO_DIR = __dirname;

function log(msg) { console.log(msg); }
function success(msg) { console.log('  ✅', msg); }
function warn(msg) { console.log('  ⚠️ ', msg); }
function info(msg) { console.log('  ℹ️ ', msg); }

// --- 1. Copy config files ---
log('\n📋 Installing config files...');

const configs = [
  { src: 'nio.config.json', dest: 'nio.config.json' },
  { src: 'configs/audit-ci.json', dest: 'audit-ci.json' },
  { src: 'configs/.secretlintrc.json', dest: '.secretlintrc.json' },
  { src: 'configs/.lockfile-lintrc.json', dest: '.lockfile-lintrc.json' },
];

for (const { src, dest } of configs) {
  const srcPath = path.join(NIO_DIR, src);
  const destPath = path.join(PROJECT_ROOT, dest);
  if (fs.existsSync(destPath)) {
    warn(`${dest} already exists — skipping`);
  } else {
    fs.copyFileSync(srcPath, destPath);
    success(`Created ${dest}`);
  }
}

// --- 2. Copy hooks ---
log('\n🪝 Installing git hooks...');

const huskyDir = path.join(PROJECT_ROOT, '.husky');
if (!fs.existsSync(huskyDir)) {
  warn('.husky not found — run "npx husky init" first, then re-run');
} else {
  const hooks = [
    { src: 'hooks/pre-commit', dest: '.husky/pre-commit' },
    { src: 'hooks/pre-push', dest: '.husky/pre-push' },
  ];

  for (const { src, dest } of hooks) {
    const srcPath = path.join(NIO_DIR, src);
    const destPath = path.join(PROJECT_ROOT, dest);
    if (fs.existsSync(destPath)) {
      warn(`${dest} already exists — review manually and merge:`);
      info(`  Template: node_modules/@merlinvicki/nio/${src}`);
    } else {
      fs.copyFileSync(srcPath, destPath);
      success(`Created ${dest}`);
    }
  }
}

// --- 3. Add package.json scripts ---
log('\n📦 Patching package.json scripts...');

const pkgPath = path.join(PROJECT_ROOT, 'package.json');
if (!fs.existsSync(pkgPath)) {
  warn('package.json not found — skipping');
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const newScripts = {
    'nio': 'nio all',
    'supply-chain': 'nio supply-chain',
    'secrets': 'nio secrets',
    'license': 'nio license',
  };

  let added = 0;
  pkg.scripts = pkg.scripts || {};
  for (const [name, cmd] of Object.entries(newScripts)) {
    if (pkg.scripts[name]) {
      warn(`Script "${name}" already exists — skipping`);
    } else {
      pkg.scripts[name] = cmd;
      added++;
    }
  }

  if (added > 0) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t'));
    success(`Added ${added} scripts to package.json`);
  }
}

log('\n✅ Done! nio is ready.\n');
log('Quick start:');
log('  npx nio list           # See which gates are active for this project');
log('  npx nio all            # Run every enabled gate → unified report');
log('  npx nio secrets        # Run a single gate');
log('\nLint/type/a11y gates light up automatically when the tools are installed:');
log('  npm i -D eslint stylelint typescript knip playwright @axe-core/playwright');
