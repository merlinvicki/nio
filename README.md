# nio

Quality gates for developers — security, secrets, licenses, lint, types, dead code, accessibility, E2E tests, and memory leaks. One command, one unified actionable report.

```
npm install --save-dev @merlinvicki/nio
npx nio install
npx nio all
```

nio runs every relevant check for your project, normalizes findings into `file:line — rule — message — how to fix`, and writes a single HTML dashboard plus machine-readable JSON for CI.

---

## Gates

| Gate | Tool | Blocks by default | Enabled when |
|---|---|---|---|
| `supply-chain` | npm signatures, retire.js, lockfile-lint, audit-ci | No | Always |
| `secrets` | secretlint | **Yes** | Always |
| `license` | license-checker (GPL/AGPL blocklist) | No | Always |
| `eslint` | your project's ESLint | **Yes** | auto — ESLint installed |
| `stylelint` | your project's Stylelint | No | auto — Stylelint installed |
| `typecheck` | `tsc --noEmit` | **Yes** | auto — tsconfig.json + typescript |
| `deadcode` | knip (unused files/exports/deps) | No | auto — knip installed |
| `a11y` | axe-core via Playwright (WCAG) | No | opt-in via config |
| `playwright` | your project's Playwright test suite | **Yes** | auto — playwright.config.{ts,js,mjs} + @playwright/test |
| `memory` | puppeteer JS-heap / DOM-node / leak checks | No | opt-in via config |

**Auto-detection:** lint/type/dead-code/playwright gates light up automatically when the tool exists in your project — nio never downloads heavy tooling itself. Security gates ship with nio and always work.

**Blocking semantics:** `nio all` exits non-zero only when a *blocking* gate fails. Non-blocking gates warn in the report without breaking CI. Every gate's `blocking` flag is configurable.

---

## Install

```bash
npm install --save-dev @merlinvicki/nio
npx nio install
```

Requires Node ≥ 18.

The installer copies (never overwrites):

```
nio.config.json            → gate configuration
audit-ci.json              → vulnerability audit thresholds
.secretlintrc.json         → secrets ruleset
.lockfile-lintrc.json      → lockfile rules
.husky/pre-commit          → secrets scan + lint   (requires npx husky init first)
.husky/pre-push            → nio all
```

and adds npm scripts: `nio`, `supply-chain`, `secrets`, `license`.

---

## CLI

```bash
npx nio all            # run all enabled gates → unified report + exit code
npx nio list           # show each gate: enabled? blocking? why?
npx nio <gate>         # run one gate (eslint, secrets, typecheck, playwright, memory, ...)
npx nio install        # copy configs + hooks into the current project
```

---

## The report

Every run writes to `test-results/`:

```
latest.html      ← open this: dashboard with per-gate findings tables
latest.json      ← CI-friendly summary (same data)
report_<ts>.html / summary_<ts>.json   ← timestamped history
```

The dashboard shows a pass/fail verdict, summary card per gate, and an expandable findings table per gate — **location, rule, severity, message, and a concrete fix** for every finding (auto-fix commands, axe help links, TS error docs, rotation advice for leaked secrets). Skipped gates show exactly what to install to enable them.

Add `test-results/` to `.gitignore`.

---

## Configuration — `nio.config.json`

```json
{
  "gates": {
    "supply-chain": { "enabled": true,   "blocking": false },
    "secrets":      { "enabled": true,   "blocking": true },
    "license":      { "enabled": true,   "blocking": false },
    "eslint":       { "enabled": "auto", "blocking": true },
    "stylelint":    { "enabled": "auto", "blocking": false },
    "typecheck":    { "enabled": "auto", "blocking": true },
    "deadcode":     { "enabled": "auto", "blocking": false },
    "a11y":         { "enabled": false,  "blocking": false, "urls": ["http://localhost:4321"] },
    "playwright":   { "enabled": "auto", "blocking": true },
    "memory":       { "enabled": false,  "blocking": false, "url": "http://localhost:4321" }
  },
  "scanTargets": ["src", "workers", "tests", "public"],
  "ignoreDirs": ["node_modules", "dist", "test-results", ".astro", ".git"],
  "auditLevel": "moderate",
  "licenseBlocklist": ["GPL-2.0", "GPL-3.0", "AGPL-1.0", "AGPL-3.0", "EUPL-1.1", "EUPL-1.2"],
  "licenseWarnlist": ["LGPL-2.0", "LGPL-2.1", "LGPL-3.0"]
}
```

- `enabled`: `true` | `false` | `"auto"` (run only if the tool is detected)
- `blocking`: `true` fails the run; `false` reports as warning
- Missing config file = sensible defaults (everything above)

---

## Enabling the optional gates

```bash
# Lint
npm i -D eslint               # + an eslint config
npm i -D stylelint stylelint-config-standard

# Types
npm i -D typescript           # + tsconfig.json

# Dead code
npm i -D knip

# Accessibility (WCAG via axe)
npm i -D playwright @axe-core/playwright
npx playwright install chromium

# E2E tests (Playwright suite)
npm i -D @playwright/test
npx playwright install
# nio auto-enables when playwright.config.{ts,js,mjs} is found

# Memory leak detection
npm i -D puppeteer
```

For accessibility, point nio at your running dev server:

```json
"a11y": { "enabled": true, "urls": ["http://localhost:3000", "http://localhost:3000/about"] }
```

For memory tests, configure the pages to check (start your preview server first):

```json
"memory": {
  "enabled": true,
  "url": "http://localhost:4321",
  "heapLimitMb": 50,
  "nodeLimit": 5000,
  "leakThresholdMb": 5,
  "pages": [
    { "url": "/", "name": "Home" },
    { "url": "/about", "name": "About" }
  ]
}
```

---

## CI usage

```yaml
# GitHub Actions
- run: npm ci
- run: npx nio all
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: nio-report
    path: test-results/
```

Exit code is non-zero only on blocking-gate failure. Parse `test-results/latest.json` for per-finding detail:

```json
{
  "passed": false,
  "gates": [{
    "id": "eslint", "passed": false, "blocking": true, "findingCount": 2,
    "findings": [{ "file": "src/bad.js", "line": 3, "rule": "eqeqeq",
                   "severity": "error", "message": "Expected '===' and instead saw '=='.",
                   "fix": "Use '===' instead of '=='." }]
  }]
}
```

---

## What each gate catches

- **supply-chain** — tampered packages (signature verification), known-vulnerable libraries (retire.js), lockfile poisoning / non-HTTPS / non-npm registry sources (lockfile-lint), moderate+ CVEs in production deps (audit-ci)
- **secrets** — committed credentials: cloud keys, GitHub/Slack tokens, private keys, high-entropy strings (secretlint recommended preset)
- **license** — strong copyleft (GPL/AGPL/EUPL) in production dependencies; LGPL warns only
- **eslint** — lint errors and warnings from your project's own ESLint config
- **stylelint** — CSS/SCSS lint errors from your project's Stylelint config
- **typecheck** — TypeScript type errors via `tsc --noEmit`
- **deadcode** — unused files, exports, and dependencies via knip
- **a11y** — WCAG 2.x violations via axe-core across configured URLs
- **playwright** — full E2E test suite using your project's Playwright config and specs
- **memory** — JS heap size, DOM node count, and heap growth (leak detection) across configured pages via puppeteer

---

## License

MIT

---

## Developer

Built by **[merlinvicki](https://github.com/merlinvicki)** — UX researcher, accessibility specialist, and AI automation consultant.

[![GitHub](https://img.shields.io/badge/GitHub-merlinvicki-181717?logo=github)](https://github.com/merlinvicki)
[![npm](https://img.shields.io/npm/v/@merlinvicki/nio?color=cb3837&logo=npm)](https://www.npmjs.com/package/@merlinvicki/nio)
