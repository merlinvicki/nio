/**
 * nio.config.json loader.
 * Merges the user's config over defaults; resolves "auto" gate enablement
 * via local detection (no network).
 */
import fs from 'fs';
import path from 'path';
import { hasDependency, hasEslintConfig, hasStylelintConfig, hasTsconfig, hasAnyFile } from './detect.js';

export const DEFAULT_CONFIG = {
	gates: {
		'supply-chain': { enabled: true, blocking: false },
		secrets: { enabled: true, blocking: true },
		license: { enabled: true, blocking: false },
		eslint: { enabled: 'auto', blocking: true },
		stylelint: { enabled: 'auto', blocking: false },
		typecheck: { enabled: 'auto', blocking: true },
		deadcode: { enabled: 'auto', blocking: false },
		a11y: { enabled: false, blocking: false, urls: ['http://localhost:4321'] },
		playwright: { enabled: 'auto', blocking: true },
		memory: { enabled: false, blocking: false, url: 'http://localhost:4321', pages: [{ url: '/', name: 'Home' }, { url: '/about', name: 'About' }] },
	},
	scanTargets: ['src', 'workers', 'tests', 'public'],
	ignoreDirs: ['node_modules', 'dist', 'test-results', '.astro', '.git'],
	auditLevel: 'moderate',
	licenseBlocklist: ['GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0', 'EUPL-1.1', 'EUPL-1.2'],
	licenseWarnlist: ['LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0'],
};

const AUTO_DETECTORS = {
	eslint: (root) => hasEslintConfig(root) || hasDependency(root, 'eslint'),
	stylelint: (root) => hasStylelintConfig(root) || hasDependency(root, 'stylelint'),
	typecheck: (root) => hasTsconfig(root) && hasDependency(root, 'typescript'),
	deadcode: (root) => hasDependency(root, 'knip'),
	playwright: (root) => hasAnyFile(root, ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']) && hasDependency(root, '@playwright/test'),
};

export function loadConfig(root) {
	const configPath = path.join(root, 'nio.config.json');
	let user = {};
	if (fs.existsSync(configPath)) {
		try {
			user = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		} catch (err) {
			console.warn(`⚠️  Could not parse nio.config.json (${err.message}) — using defaults`);
		}
	}

	const gates = {};
	for (const id of Object.keys(DEFAULT_CONFIG.gates)) {
		gates[id] = { ...DEFAULT_CONFIG.gates[id], ...(user.gates?.[id] || {}) };
	}

	return { ...DEFAULT_CONFIG, ...user, gates };
}

/** Resolve enabled: true | false | 'auto' → boolean for a given project root. */
export function isGateEnabled(id, gateConfig, root) {
	if (gateConfig.enabled === 'auto') {
		const detector = AUTO_DETECTORS[id];
		return detector ? detector(root) : true;
	}
	return Boolean(gateConfig.enabled);
}

/** Human-readable detection status for `nio list`. */
export function gateStatus(id, gateConfig, root) {
	const enabled = isGateEnabled(id, gateConfig, root);
	const auto = gateConfig.enabled === 'auto';
	return {
		id,
		enabled,
		auto,
		blocking: Boolean(gateConfig.blocking),
	};
}
