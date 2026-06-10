#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { GATES, getGate, runGates } from './runner.js';
import { findProjectRoot } from './lib/find-root.js';
import { loadConfig, isGateEnabled } from './lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
	console.log(`
nio — quality gates for security, lint, types, accessibility, and more

Usage:
  nio <command>

Commands:
  all            Run all enabled gates (per nio.config.json)
  list           Show every gate with enabled/blocking status
  install        Copy configs and hooks into the current project

Gates (run individually):
${GATES.map((g) => `  ${g.id.padEnd(14)} ${g.title}`).join('\n')}
`);
}

function list() {
	const root = findProjectRoot(process.cwd());
	const config = loadConfig(root);

	console.log(`\nGates for ${root}:\n`);
	for (const gate of GATES) {
		const gateConfig = config.gates[gate.id] || {};
		const enabled = isGateEnabled(gate.id, gateConfig, root);
		const auto = gateConfig.enabled === 'auto' ? ' (auto)' : '';
		const status = enabled ? `✅ enabled${auto}` : `⏸️  disabled${auto}`;
		const blocking = gateConfig.blocking ? '🚫 blocking' : '⚠️  warn only';
		console.log(`  ${gate.id.padEnd(14)} ${status.padEnd(22)} ${blocking}   ${gate.title}`);
	}
	console.log('\nConfigure in nio.config.json — see https://github.com/merlinvicki/nio#configuration\n');
}

const [, , cmd] = process.argv;

if (!cmd) {
	usage();
	process.exit(0);
}

if (cmd === 'install') {
	const proc = spawn(process.execPath, [path.join(__dirname, 'install.js')], {
		stdio: 'inherit',
		cwd: process.cwd(),
	});
	proc.on('close', (code) => process.exit(code ?? 0));
} else if (cmd === 'list') {
	list();
} else if (cmd === 'all') {
	runGates().then((code) => process.exit(code));
} else if (getGate(cmd)) {
	runGates([cmd]).then((code) => process.exit(code));
} else {
	usage();
	process.exit(1);
}
