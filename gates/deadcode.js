/**
 * Dead code gate — knip finds unused files, exports, and dependencies.
 */
import { runCLI } from '../lib/run-cli.js';
import { hasDependency } from '../lib/detect.js';

export default {
	id: 'deadcode',
	title: 'Dead Code (knip)',

	async run({ root }) {
		if (!hasDependency(root, 'knip')) {
			return {
				passed: true,
				skipped: true,
				hint: 'npm i -D knip to enable unused file/export/dependency detection',
				findings: [],
				raw: '',
			};
		}

		const result = await runCLI('npx', ['--no-install', 'knip', '--reporter', 'json'], { cwd: root });
		const raw = result.stdout + result.stderr;

		const findings = [];
		try {
			const parsed = JSON.parse(result.stdout);

			for (const file of parsed.files || []) {
				findings.push({
					file,
					line: null,
					rule: 'unused-file',
					severity: 'warning',
					message: 'File is never imported',
					fix: 'Delete the file, or add it to knip entry points if intentionally standalone',
				});
			}

			for (const issue of parsed.issues || []) {
				for (const exp of issue.exports || []) {
					findings.push({
						file: issue.file,
						line: exp.line ?? null,
						rule: 'unused-export',
						severity: 'warning',
						message: `Unused export: ${exp.name}`,
						fix: 'Remove the export keyword or delete the dead code',
					});
				}
				for (const type of issue.types || []) {
					findings.push({
						file: issue.file,
						line: type.line ?? null,
						rule: 'unused-type',
						severity: 'warning',
						message: `Unused exported type: ${type.name}`,
						fix: 'Remove the export keyword or delete the dead type',
					});
				}
				for (const dep of issue.dependencies || []) {
					findings.push({
						file: issue.file,
						line: null,
						rule: 'unused-dependency',
						severity: 'warning',
						message: `Unused dependency: ${dep.name ?? dep}`,
						fix: `npm uninstall ${dep.name ?? dep}`,
					});
				}
				for (const dep of issue.devDependencies || []) {
					findings.push({
						file: issue.file,
						line: null,
						rule: 'unused-dev-dependency',
						severity: 'warning',
						message: `Unused devDependency: ${dep.name ?? dep}`,
						fix: `npm uninstall ${dep.name ?? dep}`,
					});
				}
			}
		} catch {
			// knip output not parseable — fall through with raw only
		}

		console.log(`  ${findings.length} unused item(s)`);

		return { passed: result.code === 0, skipped: false, findings, raw };
	},
};
