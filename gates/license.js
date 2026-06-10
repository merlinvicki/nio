/**
 * License gate — checks production dependencies against a copyleft blocklist.
 */
import { runCLI } from '../lib/run-cli.js';

function licenseTokens(lic) {
	return lic.split(/\s+(?:AND|OR)\s+|,\s*/i).map((t) => t.trim().replace(/^\(|\)$/g, ''));
}

function matchesAny(lic, list) {
	return licenseTokens(lic).some((token) =>
		list.some((b) => token === b || token.startsWith(b + '-or-later') || token.startsWith(b + '+'))
	);
}

export default {
	id: 'license',
	title: 'License Compliance',

	async run({ root, config }) {
		const result = await runCLI('npx', [
			'license-checker', '--production', '--json', '--excludePrivatePackages',
		], { cwd: root });

		let licenseData = {};
		try {
			licenseData = JSON.parse(result.stdout);
		} catch {
			return {
				passed: true,
				skipped: true,
				hint: 'Could not parse license data — is this an npm project with installed dependencies?',
				findings: [],
				raw: result.stdout + result.stderr,
			};
		}

		const total = Object.keys(licenseData).length;
		console.log(`  Scanned ${total} production packages`);

		const findings = [];
		const licenseGroups = {};

		for (const [pkgKey, info] of Object.entries(licenseData)) {
			const licenses = Array.isArray(info.licenses) ? info.licenses : [info.licenses || 'Unknown'];
			const parts = pkgKey.replace(/^(@[^@]+)@/, '$1\0').split('\0');
			const name = parts[0] || pkgKey;
			const version = parts[1]?.replace(/^@/, '') || 'unknown';

			for (const lic of licenses) {
				licenseGroups[lic] = (licenseGroups[lic] || 0) + 1;
				if (matchesAny(lic, config.licenseBlocklist)) {
					findings.push({
						file: `${name}@${version}`,
						line: null,
						rule: lic,
						severity: 'error',
						message: `Strong copyleft license in production dependencies`,
						fix: 'Replace with a permissively-licensed alternative or obtain a commercial license',
					});
				} else if (matchesAny(lic, config.licenseWarnlist)) {
					findings.push({
						file: `${name}@${version}`,
						line: null,
						rule: lic,
						severity: 'warning',
						message: 'LGPL — dynamic linking usually OK, verify your usage',
						fix: 'Confirm the package is used unmodified as a dynamic dependency',
					});
				}
			}
		}

		const blockedCount = findings.filter((f) => f.severity === 'error').length;
		const passed = blockedCount === 0;

		const distribution = Object.entries(licenseGroups)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([lic, count]) => `${lic}: ${count}`)
			.join('\n');

		return {
			passed,
			skipped: false,
			findings,
			raw: `${total} production packages scanned\n\nLicense distribution (top 10):\n${distribution}`,
		};
	},
};
