/**
 * Type check gate — tsc --noEmit using the host project's TypeScript.
 */
import { runCLI } from '../lib/run-cli.js';
import { hasDependency, hasTsconfig } from '../lib/detect.js';

// e.g. src/app.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.
const TSC_LINE = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

export default {
	id: 'typecheck',
	title: 'Type Check (tsc)',

	async run({ root }) {
		if (!hasTsconfig(root)) {
			return { passed: true, skipped: true, hint: 'No tsconfig.json found — add one to enable type checking', findings: [], raw: '' };
		}
		if (!hasDependency(root, 'typescript')) {
			return { passed: true, skipped: true, hint: 'npm i -D typescript to enable this gate', findings: [], raw: '' };
		}

		const result = await runCLI('npx', ['--no-install', 'tsc', '--noEmit', '--pretty', 'false'], { cwd: root });
		const raw = result.stdout + result.stderr;

		const findings = [];
		for (const line of raw.split('\n')) {
			const m = line.trim().match(TSC_LINE);
			if (m) {
				findings.push({
					file: m[1],
					line: Number(m[2]),
					rule: m[5],
					severity: m[4],
					message: m[6],
					fix: `https://typescript.tv/errors/#${m[5].toLowerCase()}`,
				});
			}
		}

		console.log(`  ${findings.length} type error(s)`);

		return { passed: result.code === 0, skipped: false, findings, raw };
	},
};
