/**
 * Accessibility gate — axe-core WCAG scan via the host project's Playwright.
 * Disabled by default; needs a running server and config URLs:
 *   "a11y": { "enabled": true, "urls": ["http://localhost:3000"] }
 */
import path from 'path';
import { pathToFileURL } from 'url';
import { resolveFromRoot } from '../lib/detect.js';

export default {
	id: 'a11y',
	title: 'Accessibility (axe)',

	async run({ root, config }) {
		const playwrightPath = resolveFromRoot(root, 'playwright');
		const axePath = resolveFromRoot(root, '@axe-core/playwright');

		if (!playwrightPath || !axePath) {
			return {
				passed: true,
				skipped: true,
				hint: 'npm i -D playwright @axe-core/playwright (then `npx playwright install chromium`) to enable WCAG scanning',
				findings: [],
				raw: '',
			};
		}

		const urls = config.gates.a11y?.urls || [];
		if (!urls.length) {
			return {
				passed: true,
				skipped: true,
				hint: 'Add URLs to scan: "a11y": { "urls": ["http://localhost:3000"] } in nio.config.json',
				findings: [],
				raw: '',
			};
		}

		const { chromium } = await import(pathToFileURL(playwrightPath).href);
		const axeModule = await import(pathToFileURL(axePath).href);
		const AxeBuilder = axeModule.default?.default || axeModule.default || axeModule.AxeBuilder;

		const findings = [];
		const rawLines = [];
		let browser;

		try {
			browser = await chromium.launch();

			for (const url of urls) {
				console.log(`  Scanning ${url}...`);
				const page = await browser.newPage();
				try {
					await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
					const results = await new AxeBuilder({ page }).analyze();

					rawLines.push(`${url}: ${results.violations.length} violation(s), ${results.passes.length} rules passed`);

					for (const violation of results.violations) {
						const target = violation.nodes[0]?.target?.join(' ') || '';
						findings.push({
							file: `${url} → ${target}`.slice(0, 120),
							line: null,
							rule: violation.id,
							severity: violation.impact || 'moderate',
							message: `${violation.help} (${violation.nodes.length} element${violation.nodes.length === 1 ? '' : 's'})`,
							fix: violation.helpUrl,
						});
					}
				} catch (err) {
					findings.push({
						file: url,
						line: null,
						rule: 'page-unreachable',
						severity: 'error',
						message: `Could not scan: ${err.message.split('\n')[0].slice(0, 200)}`,
						fix: 'Make sure the dev server is running before the a11y gate',
					});
				} finally {
					await page.close();
				}
			}
		} finally {
			await browser?.close();
		}

		console.log(`  ${findings.length} violation(s) across ${urls.length} URL(s)`);

		return { passed: findings.length === 0, skipped: false, findings, raw: rawLines.join('\n') };
	},
};
