/**
 * Unified report writer.
 * Takes normalized gate results, writes:
 *   test-results/nio/report_<ts>.html  + latest.html
 *   test-results/nio/summary_<ts>.json + latest.json
 */
import fs from 'fs';
import path from 'path';

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function statusOf(r) {
	if (r.skipped) return { label: 'Skipped', icon: '⏭️', color: '#374151' };
	if (r.passed) return { label: 'Passed', icon: '✅', color: '#064e3b' };
	return { label: 'Failed', icon: '❌', color: '#7f1d1d' };
}

function severityColor(severity) {
	const s = String(severity || '').toLowerCase();
	if (['error', 'critical', 'serious', 'high'].includes(s)) return '#f87171';
	if (['warning', 'moderate', 'medium'].includes(s)) return '#fbbf24';
	return '#94a3b8';
}

function findingsTable(findings) {
	if (!findings.length) return '';
	const rows = findings
		.map((f) => {
			const loc = f.line ? `${esc(f.file)}:${f.line}` : esc(f.file || '');
			const fix = /^https?:\/\//.test(f.fix || '')
				? `<a href="${esc(f.fix)}" target="_blank" rel="noopener">docs</a>`
				: esc(f.fix || '');
			return `<tr>
				<td class="loc">${loc}</td>
				<td>${esc(f.rule || '')}</td>
				<td style="color:${severityColor(f.severity)}">${esc(f.severity || '')}</td>
				<td>${esc(f.message || '')}</td>
				<td class="fix">${fix}</td>
			</tr>`;
		})
		.join('\n');

	return `<table>
		<thead><tr><th>Location</th><th>Rule</th><th>Severity</th><th>Message</th><th>Fix</th></tr></thead>
		<tbody>${rows}</tbody>
	</table>`;
}

function gateSection(r) {
	const status = statusOf(r);
	const count = r.findings?.length || 0;
	const blocking = r.blocking ? '<span class="badge badge-blocking">blocking</span>' : '<span class="badge">warn only</span>';
	const hint = r.skipped && r.hint ? `<p class="hint">💡 ${esc(r.hint)}</p>` : '';
	const raw = r.raw?.trim()
		? `<details class="raw"><summary>Raw tool output</summary><pre>${esc(r.raw.slice(0, 8000))}</pre></details>`
		: '';

	return `<details class="gate" ${!r.passed && !r.skipped ? 'open' : ''}>
		<summary style="border-left:4px solid ${status.color}">
			<span>${status.icon} <strong>${esc(r.title)}</strong> ${blocking}</span>
			<span class="count">${r.skipped ? status.label : `${count} finding${count === 1 ? '' : 's'}`}</span>
		</summary>
		<div class="body">
			${hint}
			${findingsTable(r.findings || [])}
			${raw}
		</div>
	</details>`;
}

function buildHtml(results, timestamp, passed) {
	const ran = results.filter((r) => !r.skipped);
	const failed = ran.filter((r) => !r.passed);
	const totalFindings = results.reduce((n, r) => n + (r.findings?.length || 0), 0);

	const cards = results
		.map((r) => {
			const s = statusOf(r);
			return `<div class="card" style="background:${s.color}">
				<div class="card-title">${esc(r.title)}</div>
				<div class="card-status">${s.icon} ${s.label}</div>
				<div class="card-count">${r.skipped ? '' : `${r.findings?.length || 0} findings`}</div>
			</div>`;
		})
		.join('\n');

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>nio report</title>
<style>
	body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px;line-height:1.5}
	h1{color:#38bdf8;margin:0 0 4px}
	.sub{color:#94a3b8;margin-bottom:24px}
	.verdict{font-size:18px;padding:12px 16px;border-radius:8px;margin-bottom:24px;background:${passed ? '#064e3b' : '#7f1d1d'}}
	.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:32px}
	.card{padding:14px;border-radius:8px}
	.card-title{font-weight:600;margin-bottom:6px}
	.card-status{font-size:14px}
	.card-count{font-size:12px;color:#cbd5e1;margin-top:4px}
	.gate{margin-bottom:12px;background:#1e293b;border-radius:8px;overflow:hidden}
	.gate summary{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;list-style:none}
	.gate summary::-webkit-details-marker{display:none}
	.count{color:#94a3b8;font-size:13px}
	.body{padding:0 16px 16px}
	.badge{font-size:11px;background:#334155;border-radius:10px;padding:2px 8px;margin-left:8px;color:#cbd5e1}
	.badge-blocking{background:#9a3412}
	.hint{color:#fbbf24;background:#27272a;padding:8px 12px;border-radius:6px}
	table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
	th{text-align:left;color:#94a3b8;font-weight:600;padding:6px 8px;border-bottom:1px solid #334155}
	td{padding:6px 8px;border-bottom:1px solid #1f2937;vertical-align:top}
	.loc{font-family:ui-monospace,monospace;color:#7dd3fc;white-space:nowrap}
	.fix{color:#86efac}
	.fix a{color:#7dd3fc}
	.raw{margin-top:12px}
	.raw summary{color:#94a3b8;font-size:13px;cursor:pointer;padding:4px 0}
	pre{background:#111;padding:12px;border-radius:6px;overflow:auto;font-size:11px;max-height:300px}
</style>
</head>
<body>
	<h1>nio report</h1>
	<div class="sub">${timestamp} — ${ran.length} gate${ran.length === 1 ? '' : 's'} ran, ${results.length - ran.length} skipped, ${totalFindings} total findings</div>
	<div class="verdict">${passed ? '✅ All blocking gates passed' : `❌ ${failed.filter((r) => r.blocking).length} blocking gate(s) failed: ${failed.filter((r) => r.blocking).map((r) => r.title).join(', ') || '—'}`}</div>
	<div class="cards">${cards}</div>
	${results.map(gateSection).join('\n')}
</body>
</html>`;
}

export function writeReports(results, root) {
	const reportDir = path.join(root, 'test-results', 'nio');
	fs.mkdirSync(reportDir, { recursive: true });

	const timestamp = new Date().toISOString();
	const ts = timestamp.replace(/:/g, '-').split('.')[0];

	const blockingFailures = results.filter((r) => !r.skipped && !r.passed && r.blocking);
	const passed = blockingFailures.length === 0;

	const summary = {
		timestamp,
		passed,
		gates: results.map((r) => ({
			id: r.id,
			title: r.title,
			passed: r.passed,
			skipped: r.skipped,
			blocking: r.blocking,
			hint: r.hint || null,
			findingCount: r.findings?.length || 0,
			findings: r.findings || [],
		})),
	};

	const html = buildHtml(results, timestamp, passed);

	fs.writeFileSync(path.join(reportDir, `report_${ts}.html`), html);
	fs.writeFileSync(path.join(reportDir, 'latest.html'), html);
	fs.writeFileSync(path.join(reportDir, `summary_${ts}.json`), JSON.stringify(summary, null, 2));
	fs.writeFileSync(path.join(reportDir, 'latest.json'), JSON.stringify(summary, null, 2));

	return { passed, summary, htmlPath: path.join('test-results', 'nio', 'latest.html') };
}
