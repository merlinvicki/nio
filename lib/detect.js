/**
 * Tool / config detection helpers for "auto" gate enablement.
 * All checks are local to the consuming project — no network, no npx downloads.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

/** Can `name` be resolved from the project root's node_modules? */
export function hasDependency(root, name) {
	try {
		const req = createRequire(path.join(root, 'package.json'));
		req.resolve(name);
		return true;
	} catch {
		return false;
	}
}

/** Resolve a module's entry path from the project root, or null. */
export function resolveFromRoot(root, name) {
	try {
		const req = createRequire(path.join(root, 'package.json'));
		return req.resolve(name);
	} catch {
		return null;
	}
}

export function hasAnyFile(root, names) {
	return names.some((n) => fs.existsSync(path.join(root, n)));
}

function readPkg(root) {
	try {
		return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
	} catch {
		return {};
	}
}

export function hasEslintConfig(root) {
	const files = [
		'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts',
		'.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yml', '.eslintrc.yaml',
	];
	return hasAnyFile(root, files) || Boolean(readPkg(root).eslintConfig);
}

export function hasStylelintConfig(root) {
	const files = [
		'.stylelintrc', '.stylelintrc.json', '.stylelintrc.js', '.stylelintrc.cjs', '.stylelintrc.yml', '.stylelintrc.yaml',
		'stylelint.config.js', 'stylelint.config.mjs', 'stylelint.config.cjs',
	];
	return hasAnyFile(root, files) || Boolean(readPkg(root).stylelint);
}

export function hasTsconfig(root) {
	return fs.existsSync(path.join(root, 'tsconfig.json'));
}
