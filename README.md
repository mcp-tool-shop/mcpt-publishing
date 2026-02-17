<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop/mcpt-publishing/main/logo.png" alt="mcpt-publishing logo" width="520" />
</p>

<h1 align="center">mcpt-publishing</h1>

<p align="center">
  <b>A human-first publishing house for your repos.</b><br/>
  Audit, fix, and publish to npm/NuGet/PyPI/GHCR with receipts you can verify.
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop/mcpt-publishing/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/mcp-tool-shop/mcpt-publishing?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/mcpt-publishing"><img alt="npm" src="https://img.shields.io/npm/v/@mcptoolshop/mcpt-publishing?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
</p>

---

## What it is

**mcpt-publishing** is a portable "publishing layer" that sits between your repos and public registries.

It answers the annoying questions humans actually have:

- *Are my registry pages stale or embarrassing?*
- *Do tags/releases match what's published?*
- *Which packages need a metadata refresh right now?*
- *Can I publish safely, repeatedly, and prove what happened?*

Every run produces **receipts**: immutable JSON artifacts with SHA-256 hashes, commit SHAs, and links to registry pages and GitHub releases.

---

## Who this is for

**For you if...**

- You publish to **npm and/or NuGet** and your pages drift over time (they do).
- You want a single place to enforce "registry truth" (versions, tags, URLs, READMEs, icons).
- You want automation that's safe: **plans, PRs, receipts**, and no surprise pushes.

**Not for you if...**

- You want a marketing site or spotlight engine (this is the plumbing).
- You want a monolithic CI framework (this is a small toolkit you can embed anywhere).

---

## 60-second quickstart

### Install

```bash
npm i -D @mcptoolshop/mcpt-publishing
```

### Initialize

```bash
npx mcpt-publishing init
```

This scaffolds:

- `publishing.config.json`
- `profiles/` (where repos/packages are declared)
- `reports/` and `receipts/` output folders

### Run an audit

```bash
npx mcpt-publishing audit
```

Outputs:

- `reports/latest.md` (human-readable)
- `reports/latest.json` (machine-readable)
- a receipt under `receipts/`

---

## Core commands

### `mcpt-publishing audit`

Checks your publishing surfaces across enabled registries.

```bash
npx mcpt-publishing audit
npx mcpt-publishing audit --json
```

### `mcpt-publishing plan`

Generates a safe plan to fix drift (no network writes). *(coming soon)*

```bash
npx mcpt-publishing plan
npx mcpt-publishing plan --repo mcp-tool-shop-org/soundboard-maui
```

### `mcpt-publishing apply`

Applies the plan as PRs (never pushes to main). *(coming soon)*

```bash
npx mcpt-publishing apply
npx mcpt-publishing apply --batch
```

### `mcpt-publishing publish`

Publishes packages to registries and generates immutable receipts.

```bash
npx mcpt-publishing publish --repo mcp-tool-shop-org/mcpt --target npm
npx mcpt-publishing publish --repo mcp-tool-shop-org/soundboard-maui --target nuget --cwd /path/to/repo
npx mcpt-publishing publish --target npm --dry-run
```

### `mcpt-publishing providers`

Shows enabled providers and required env vars.

```bash
npx mcpt-publishing providers
```

### `mcpt-publishing verify-receipt`

Validates receipt files against schema and computes integrity hashes.

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-02-17.json
npx mcpt-publishing verify-receipt receipts/publish/mcp-tool-shop-org--mcpt/npm/1.0.1.json --json
```

---

## Optional: assets plugin (logos + images)

Core is zero-dependency. Visual updates (logos, icons, OG images) are handled by an optional plugin: *(coming soon)*

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets doctor
npx mcpt-publishing assets logo --repo mcp-tool-shop-org/mcpt
```

This plugin depends on `sharp` and is kept separate so installs remain fast and reliable.

---

## Configuration

### `publishing.config.json`

Controls paths, enabled registries, and GitHub "glue" behaviors (attach receipts to releases, update pinned health issue, etc.).

### `profiles/`

Each profile declares:

- the repo
- the packages it publishes
- target registries (npm/nuget/pypi/ghcr)
- any special rules (tag prefix, monorepo paths, etc.)

Schemas live in:

- `schemas/profile.schema.json`
- `schemas/receipt.schema.json`

Contract + phases: `docs/CONTRACT.md`

---

## Environment variables

These are only needed when you publish or call APIs that require auth.

| Target | Env var(s) | Notes |
|--------|------------|-------|
| npm | `NPM_TOKEN` | Use a granular token with publish rights |
| NuGet | `NUGET_API_KEY` | Works in CI or locally |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | For releases/issues/ghcr |
| PyPI | `PYPI_TOKEN` | If you enable PyPI publishing |

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `2` | RED-severity drift found (audit) |
| `3` | Configuration or schema error |
| `4` | Missing credentials for a requested operation |
| `5` | One or more publishes failed |

---

## Receipts

Receipts are append-only JSON files written under `receipts/`.

They include:

- commit SHA
- registry versions
- URLs
- SHA-256 hashes of key artifacts

If you like receipts, you can plug this into the receipt factory as the "publishing plugin."

---

## Development

```bash
npm test
node scripts/audit.mjs
```

Smoke tests:

```bash
node scripts/test-providers.mjs
```

---

## License

MIT — see [LICENSE](LICENSE).
