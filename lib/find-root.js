/**
 * Walk up from startDir until we find a package.json that is NOT inside node_modules.
 * Returns the directory containing package.json (the consuming project root).
 */
import fs from 'fs';
import path from 'path';

const NODE_MODULES = `${path.sep}node_modules${path.sep}`;
const NODE_MODULES_END = `${path.sep}node_modules`;

function isInsideNodeModules(dir) {
	const normalized = dir + path.sep;
	return normalized.includes(NODE_MODULES) || dir.endsWith(NODE_MODULES_END);
}

export function findProjectRoot(startDir) {
	let dir = startDir;
	while (true) {
		if (!isInsideNodeModules(dir) && fs.existsSync(path.join(dir, 'package.json'))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) throw new Error('Could not find project root (no package.json outside node_modules)');
		dir = parent;
	}
}
