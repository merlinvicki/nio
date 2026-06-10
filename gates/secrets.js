/**
 * Secrets gate — scans source files for committed credentials via secretlint.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCLI } from '../lib/run-cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_CONFIG = path.join(__dirname, '..', 'configs', '.secretlintrc.json');

function getFilesToScan(root, targets, ignoreList) {
	const files = [];
	const scanExts = [
		'.ts', '.tsx', '.js', '.jsx', '.astro', '.json', '.env',
		'.md', '.toml', '.yaml', '.yml', '.sh', '.mjs', '.cjs',
	];

	function walk(dir) {
		if (!fs.existsSync(dir)) return;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (ignoreList.includes(entry.name)) continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (scanExts.includes(path.extname(entry.name).toLowerCase()) || entry.name.startsWith('.env')) {
				files.push(full);
			}
		}
	}

	for (const target of targets) {
		walk(path.join(root, target));
	}
	return files;
}

export default {
	id: 'secrets',
	title: 'Secrets Scan',

	async run({ root, config }) {
		const files = getFilesToScan(root, config.scanTargets, config.ignoreDirs);
		console.log(`  Scanning ${files.length} files in: ${config.scanTargets.join(', ')}`);

		if (files.length === 0) {
			return { passed: true, skipped: false, findings: [], raw: 'No files matched scan targets' };
		}

		// Use the host's config when present, otherwise fall back to nio's bundled one
		const hostConfig = path.join(root, '.secretlintrc.json');
		const configPath = fs.existsSync(hostConfig) ? hostConfig : BUNDLED_CONFIG;
		const args = ['secretlint', '--format', 'json', '--secretlintrc', `"${configPath}"`];
		args.push(...files.map((f) => path.relative(root, f)));

		const result = await runCLI('npx', args, { cwd: root });
		const passed = result.code === 0;
		const raw = result.stdout + result.stderr;

		const findings = [];
		try {
			const parsed = JSON.parse(result.stdout);
			for (const fileResult of parsed) {
				for (const msg of fileResult.messages || []) {
					findings.push({
						file: path.relative(root, fileResult.filePath),
						line: msg.loc?.start?.line ?? null,
						rule: msg.ruleId || 'secretlint',
						severity: msg.severity || 'error',
						message: msg.message,
						fix: 'Remove the credential, rotate it, and load via environment variable instead',
					});
				}
			}
		} catch {
			// non-JSON output (e.g. config error) — raw is still attached
		}

		return { passed, skipped: false, findings, raw };
	},
};
