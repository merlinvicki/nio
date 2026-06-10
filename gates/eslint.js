/**
 * ESLint gate — runs the host project's ESLint with JSON output.
 */
import fs from 'fs';
import path from 'path';
import { runCLI } from '../lib/run-cli.js';
import { hasDependency } from '../lib/detect.js';

export default {
	id: 'eslint',
	title: 'ESLint',

	async run({ root, config }) {
		if (!hasDependency(root, 'eslint')) {
			return {
				passed: true,
				skipped: true,
				hint: 'npm i -D eslint (plus a config) to enable this gate',
				findings: [],
				raw: '',
			};
		}

		const targets = config.scanTargets.filter((t) => fs.existsSync(path.join(root, t)));
		const args = ['--no-install', 'eslint', '--format', 'json', '--no-error-on-unmatched-pattern'];
		args.push(...(targets.length ? targets : ['.']));

		const result = await runCLI('npx', args, { cwd: root });
		const raw = result.stderr;

		let findings = [];
		let errorCount = 0;
		try {
			const parsed = JSON.parse(result.stdout);
			for (const fileResult of parsed) {
				for (const msg of fileResult.messages || []) {
					if (msg.severity === 2) errorCount++;
					findings.push({
						file: path.relative(root, fileResult.filePath),
						line: msg.line ?? null,
						rule: msg.ruleId || 'parse-error',
						severity: msg.severity === 2 ? 'error' : 'warning',
						message: msg.message,
						fix: msg.fix
							? 'Auto-fixable — run `npx eslint --fix`'
							: msg.suggestions?.[0]?.desc || '',
					});
				}
			}
		} catch {
			// ESLint itself crashed (bad config etc.) — surface as a single finding
			return {
				passed: false,
				skipped: false,
				findings: [{
					file: 'eslint',
					line: null,
					rule: 'eslint-crash',
					severity: 'error',
					message: (result.stderr || result.stdout).split('\n')[0]?.slice(0, 300) || 'ESLint failed to run',
					fix: 'Fix the ESLint configuration error shown in the raw output',
				}],
				raw: result.stdout + result.stderr,
			};
		}

		console.log(`  ${findings.length} problem(s), ${errorCount} error(s)`);

		return { passed: errorCount === 0, skipped: false, findings, raw };
	},
};
