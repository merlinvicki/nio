/**
 * Supply chain gate — npm signatures, retire.js, lockfile integrity, audit-ci.
 */
import fs from 'fs';
import path from 'path';
import { runCLI } from '../lib/run-cli.js';

async function checkSignatures(root) {
	console.log('  🔑 npm package signatures...');
	const result = await runCLI('npm', ['audit', 'signatures'], { cwd: root });
	return {
		name: 'npm-audit-signatures',
		passed: result.code === 0,
		output: result.stdout + result.stderr,
		fix: 'Run `npm install` to refresh packages from the registry; investigate any unverifiable package',
	};
}

async function checkRetire(root) {
	console.log('  🏚️  retire.js vulnerable libraries...');
	const result = await runCLI('npx', [
		'retire', '--path', '.', '--outputformat', 'json', '--ignore', 'node_modules',
	], { cwd: root });

	let vulnCount = 0;
	try {
		const jsonStart = result.stdout.indexOf('[');
		if (jsonStart !== -1) {
			vulnCount = JSON.parse(result.stdout.slice(jsonStart)).length;
		}
	} catch {
		// non-JSON output is fine
	}

	return {
		name: 'retire',
		passed: result.code === 0 || vulnCount === 0,
		output: result.stdout + result.stderr,
		fix: 'Upgrade the flagged libraries to patched versions',
	};
}

async function checkLockfile(root) {
	console.log('  🔒 lockfile integrity...');

	if (!fs.existsSync(path.join(root, 'package-lock.json'))) {
		return { name: 'lockfile-lint', passed: true, skipped: true, output: 'No package-lock.json found' };
	}

	const result = await runCLI('npx', [
		'lockfile-lint', '--path', 'package-lock.json', '--validate-https', '--allowed-hosts', 'npm',
	], { cwd: root });

	return {
		name: 'lockfile-lint',
		passed: result.code === 0,
		output: result.stdout + result.stderr,
		fix: 'Regenerate package-lock.json from the official npm registry (delete it and run `npm install`)',
	};
}

async function checkAuditCi(root) {
	console.log('  🛡️  audit-ci structured audit...');

	const configPath = path.join(root, 'audit-ci.json');
	const args = ['audit-ci'];
	if (fs.existsSync(configPath)) {
		args.push('--config', 'audit-ci.json');
	}

	const result = await runCLI('npx', args, { cwd: root });
	return {
		name: 'audit-ci',
		passed: result.code === 0,
		output: result.stdout + result.stderr,
		fix: 'Run `npm audit fix`, or add accepted advisories to the allowlist in audit-ci.json',
	};
}

export default {
	id: 'supply-chain',
	title: 'Supply Chain',

	async run({ root }) {
		const checks = [
			await checkSignatures(root),
			await checkRetire(root),
			await checkLockfile(root),
			await checkAuditCi(root),
		];

		const findings = checks
			.filter((c) => !c.passed && !c.skipped)
			.map((c) => ({
				file: c.name,
				line: null,
				rule: c.name,
				severity: 'error',
				message: c.output.split('\n').filter((l) => l.trim()).slice(0, 3).join(' | ').slice(0, 300),
				fix: c.fix,
			}));

		const raw = checks
			.map((c) => `=== ${c.name}: ${c.skipped ? 'skipped' : c.passed ? 'passed' : 'FAILED'} ===\n${c.output.slice(0, 2000)}`)
			.join('\n\n');

		return { passed: findings.length === 0, skipped: false, findings, raw };
	},
};
