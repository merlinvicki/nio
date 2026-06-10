/**
 * Stylelint gate — runs the host project's Stylelint on CSS/SCSS/Less files.
 */
import path from 'path';
import { runCLI } from '../lib/run-cli.js';
import { hasDependency } from '../lib/detect.js';

export default {
	id: 'stylelint',
	title: 'Stylelint',

	async run({ root }) {
		if (!hasDependency(root, 'stylelint')) {
			return {
				passed: true,
				skipped: true,
				hint: 'npm i -D stylelint stylelint-config-standard to enable this gate',
				findings: [],
				raw: '',
			};
		}

		const result = await runCLI('npx', [
			'--no-install', 'stylelint', '"**/*.{css,scss,sass,less}"',
			'--formatter', 'json', '--allow-empty-input',
		], { cwd: root });

		let findings = [];
		try {
			// Stylelint may print the JSON to stdout or stderr depending on version
			const jsonText = (result.stdout.trim().startsWith('[') ? result.stdout : result.stderr).trim();
			const parsed = JSON.parse(jsonText);
			for (const fileResult of parsed) {
				for (const warning of fileResult.warnings || []) {
					findings.push({
						file: path.relative(root, fileResult.source || ''),
						line: warning.line ?? null,
						rule: warning.rule || 'stylelint',
						severity: warning.severity || 'error',
						message: warning.text,
						fix: 'Many rules are auto-fixable — run `npx stylelint --fix "**/*.css"`',
					});
				}
			}
		} catch {
			if (result.code !== 0) {
				return {
					passed: false,
					skipped: false,
					findings: [{
						file: 'stylelint',
						line: null,
						rule: 'stylelint-crash',
						severity: 'error',
						message: (result.stderr || result.stdout).split('\n')[0]?.slice(0, 300) || 'Stylelint failed to run',
						fix: 'Fix the Stylelint configuration error shown in the raw output',
					}],
					raw: result.stdout + result.stderr,
				};
			}
		}

		console.log(`  ${findings.length} problem(s)`);

		const errorCount = findings.filter((f) => f.severity === 'error').length;
		return { passed: errorCount === 0, skipped: false, findings, raw: result.stderr };
	},
};
