#!/usr/bin/env node
/**
 * nio gate runner — loads config, runs enabled gates, writes the unified report.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { findProjectRoot } from './lib/find-root.js';
import { loadConfig, isGateEnabled } from './lib/config.js';
import { writeReports } from './lib/report.js';

import supplyChain from './gates/supply-chain.js';
import secrets from './gates/secrets.js';
import license from './gates/license.js';
import eslint from './gates/eslint.js';
import stylelint from './gates/stylelint.js';
import typecheck from './gates/typecheck.js';
import deadcode from './gates/deadcode.js';
import a11y from './gates/a11y.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const GATES = [supplyChain, secrets, license, eslint, stylelint, typecheck, deadcode, a11y];

export function getGate(id) {
	return GATES.find((g) => g.id === id);
}

/**
 * Run the given gate ids (or all enabled gates when ids is empty/null).
 * Returns the process exit code.
 */
export async function runGates(ids = null) {
	const root = findProjectRoot(process.cwd());
	const config = loadConfig(root);

	const selected = ids?.length
		? GATES.filter((g) => ids.includes(g.id))
		: GATES.filter((g) => isGateEnabled(g.id, config.gates[g.id], root));

	console.log(`🔒 nio — running ${selected.length} gate(s) in ${root}\n`);

	const results = [];

	for (const gate of selected) {
		const gateConfig = config.gates[gate.id] || {};
		console.log(`▶ ${gate.title}`);

		let result;
		try {
			result = await gate.run({ root, config });
		} catch (err) {
			result = {
				passed: false,
				skipped: false,
				findings: [{
					file: gate.id,
					line: null,
					rule: 'gate-crash',
					severity: 'error',
					message: err.message.slice(0, 300),
					fix: 'This is likely a nio bug or environment issue — check the raw output',
				}],
				raw: err.stack || String(err),
			};
		}

		result.id = gate.id;
		result.title = gate.title;
		result.blocking = Boolean(gateConfig.blocking);

		const icon = result.skipped ? '⏭️ ' : result.passed ? '✅' : result.blocking ? '❌' : '⚠️ ';
		const note = result.skipped
			? `skipped${result.hint ? ` — ${result.hint}` : ''}`
			: result.passed
				? 'passed'
				: `${result.findings.length} finding(s)${result.blocking ? ' [BLOCKING]' : ' [warn only]'}`;
		console.log(`  ${icon} ${note}\n`);

		results.push(result);
	}

	const { passed, htmlPath } = writeReports(results, root);

	const failed = results.filter((r) => !r.skipped && !r.passed);
	const blockingFailed = failed.filter((r) => r.blocking);

	if (passed) {
		console.log(`✅ All blocking gates passed${failed.length ? ` (${failed.length} non-blocking warning(s))` : ''}`);
	} else {
		console.error(`❌ Blocking gate(s) failed: ${blockingFailed.map((r) => r.title).join(', ')}`);
	}
	console.log(`📄 Report: ${htmlPath}`);

	return passed ? 0 : 1;
}

// Allow `node runner.js` directly (used by `npm test` in this repo)
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(__dirname, 'runner.js')) {
	runGates().then((code) => process.exit(code));
}
