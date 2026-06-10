import { spawn } from 'child_process';

/**
 * Run a CLI command, capturing stdout/stderr. Never rejects —
 * spawn errors resolve as { code: 1, stderr: message }.
 */
export function runCLI(command, args = [], options = {}) {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: true,
			...options,
		});

		let stdout = '';
		let stderr = '';
		proc.stdout?.on('data', (d) => (stdout += d));
		proc.stderr?.on('data', (d) => (stderr += d));

		proc.on('close', (code) => resolve({ code, stdout, stderr }));
		proc.on('error', (err) => resolve({ code: 1, stdout: '', stderr: err.message }));
	});
}
