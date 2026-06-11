/**
 * Playwright E2E gate — runs the host project's Playwright test suite.
 * Auto-enabled when playwright.config.{ts,js,mjs} and @playwright/test are found.
 */
import { runCLI } from '../lib/run-cli.js';
import { hasDependency, hasAnyFile } from '../lib/detect.js';

export default {
	id: 'playwright',
	title: 'Playwright E2E Tests',

	async run({ root }) {
		if (!hasAnyFile(root, ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'])) {
			return { passed: true, skipped: true, hint: 'No playwright.config.{ts,js,mjs} — add one to enable E2E testing', findings: [], raw: '' };
		}
		if (!hasDependency(root, '@playwright/test')) {
			return { passed: true, skipped: true, hint: 'npm i -D @playwright/test to enable this gate', findings: [], raw: '' };
		}

		const result = await runCLI('npx', ['playwright', 'test', '--reporter=json'], { cwd: root });

		// JSON reporter writes full JSON to stdout; npx may prefix a line or two
		let report = {};
		try {
			report = JSON.parse(result.stdout);
		} catch {
			const jsonStart = result.stdout.indexOf('{');
			if (jsonStart !== -1) {
				try { report = JSON.parse(result.stdout.slice(jsonStart)); } catch { /* leave empty */ }
			}
		}

		if (!report.suites && result.code !== 0) {
			return {
				passed: false, skipped: false,
				findings: [{
					file: 'playwright', line: null, rule: 'playwright/run-error', severity: 'error',
					message: (result.stderr || result.stdout).split('\n').find(l => l.trim()) || 'playwright failed',
					fix: 'Run: npx playwright install --with-deps',
				}],
				raw: result.stderr || result.stdout,
			};
		}

		const findings = [];

		function processSuite(suite) {
			for (const spec of suite.specs || []) {
				for (const test of spec.tests || []) {
					if (test.status === 'unexpected' || test.status === 'failed') {
						const errMsg = test.results?.[0]?.error?.message?.split('\n')[0]?.slice(0, 200) || test.status;
						findings.push({
							file: spec.file ? `${spec.file}:${spec.line || 0}` : suite.title,
							line: spec.line || null,
							rule: 'playwright/test-failure',
							severity: 'error',
							message: `${spec.title} — ${errMsg}`,
							fix: 'Run: npx playwright test --debug to inspect',
						});
					}
				}
			}
			for (const sub of suite.suites || []) processSuite(sub);
		}
		for (const suite of report.suites || []) processSuite(suite);

		const s = report.stats || {};
		const raw = [
			s.expected != null && `${s.expected} passed`,
			s.unexpected != null && `${s.unexpected} failed`,
			s.skipped && `${s.skipped} skipped`,
		].filter(Boolean).join(', ') || result.stdout.trim().split('\n').slice(-2).join(' ');

		console.log(`  ${findings.length} failure(s)`);

		return { passed: result.code === 0, skipped: false, findings, raw };
	},
};
