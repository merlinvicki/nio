/**
 * Memory gate — puppeteer JS-heap / DOM-node / leak checks on key pages.
 * Disabled by default; requires a running preview server.
 * Configure pages and URL in nio.config.json:
 *   "memory": { "enabled": true, "url": "http://localhost:4321", "pages": [...] }
 */
import { pathToFileURL } from 'url';
import { resolveFromRoot } from '../lib/detect.js';

export default {
	id: 'memory',
	title: 'Memory Leak Tests',

	async run({ root, config }) {
		const puppeteerPath = resolveFromRoot(root, 'puppeteer');
		if (!puppeteerPath) {
			return { passed: true, skipped: true, hint: 'npm i -D puppeteer to enable memory leak detection', findings: [], raw: '' };
		}

		const cfg = config?.gates?.memory || {};
		const baseUrl = cfg.url || 'http://localhost:4321';
		const heapLimitMb = cfg.heapLimitMb ?? 50;
		const nodeLimit = cfg.nodeLimit ?? 5000;
		const leakThresholdMb = cfg.leakThresholdMb ?? 5;
		const pages = cfg.pages || [
			{ url: '/', name: 'Home' },
			{ url: '/about', name: 'About' },
		];

		const { default: puppeteer } = await import(pathToFileURL(puppeteerPath).href);

		const findings = [];
		let browser;

		try {
			browser = await puppeteer.launch({
				headless: 'new',
				args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-precise-memory-info'],
			});

			for (const pg of pages) {
				const page = await browser.newPage();
				try {
					await page.goto(baseUrl + pg.url, { waitUntil: 'networkidle0', timeout: 30000 });
					await new Promise((r) => setTimeout(r, 2000));

					const metrics = await page.metrics();
					const heapMb = metrics.JSHeapUsedSize / 1024 / 1024;
					const nodes = await page.evaluate(() => document.querySelectorAll('*').length);

					if (heapMb >= heapLimitMb) findings.push({
						file: pg.url, line: null, rule: 'memory/heap-exceeded', severity: 'error',
						message: `${pg.name}: JS heap ${heapMb.toFixed(1)} MB exceeds ${heapLimitMb} MB`,
						fix: 'Dispose Three.js objects, cancel animation frames, reduce bundle size',
					});

					if (nodes >= nodeLimit) findings.push({
						file: pg.url, line: null, rule: 'memory/dom-nodes-exceeded', severity: 'error',
						message: `${pg.name}: ${nodes} DOM nodes exceeds ${nodeLimit}`,
						fix: 'Reduce DOM complexity',
					});

					// Leak detection: 3 heap samples over ~6 s
					const samples = [];
					for (let i = 0; i < 3; i++) {
						await new Promise((r) => setTimeout(r, 2000));
						const m = await page.metrics();
						samples.push(m.JSHeapUsedSize / 1024 / 1024);
					}
					const growth = samples[2] - samples[0];
					if (growth > leakThresholdMb) findings.push({
						file: pg.url, line: null, rule: 'memory/leak-detected', severity: 'error',
						message: `${pg.name}: heap grew ${growth.toFixed(1)} MB — possible leak`,
						fix: 'Remove event listeners on unmount, cancel requestAnimationFrame, call .dispose() on Three.js objects',
					});

					console.log(`  ${pg.name}: heap ${heapMb.toFixed(1)} MB, ${nodes} nodes, growth ${growth.toFixed(1)} MB`);
				} catch (err) {
					findings.push({
						file: pg.url, line: null, rule: 'memory/page-unreachable', severity: 'error',
						message: `${pg.name}: ${err.message.split('\n')[0].slice(0, 200)}`,
						fix: `Start preview server at ${baseUrl} before running: npx nio memory`,
					});
				} finally {
					await page.close();
				}
			}
		} finally {
			await browser?.close();
		}

		return {
			passed: findings.length === 0, skipped: false, findings,
			raw: findings.length === 0
				? `All ${pages.length} pages within memory thresholds`
				: `${findings.length} issue(s) across ${pages.length} pages`,
			hint: findings.length > 0 ? 'Run: npm run preview before this gate' : undefined,
		};
	},
};
