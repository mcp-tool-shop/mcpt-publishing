<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop/mcpt-publishing/main/logo.png" alt="mcpt-publishing logo" width="520" />
</p>

<p align="center">
  Catch registry drift before your users do.
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop/mcpt-publishing/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/mcp-tool-shop/mcpt-publishing?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/mcpt-publishing"><img alt="npm" src="https://img.shields.io/npm/v/@mcptoolshop/mcpt-publishing?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
</p>

---

You publish to npm, PyPI, and NuGet. Over time, your registry pages drift: stale descriptions, missing homepage links, tags that don't match releases, README headers without logos. Nobody notices until a user does.

**mcpt-publishing** audits your published packages across registries, finds the drift, fixes it, and gives you a receipt proving what happened. Zero dependencies. Node 22+.

## Quickstart

```bash
# Scaffold config + profiles
npx mcpt-publishing init

# Audit everything — writes reports/latest.md + receipt
npx mcpt-publishing audit

# Preview what fix would change
npx mcpt-publishing fix --dry-run

# Apply fixes
npx mcpt-publishing fix
```

That's it. Run `audit` in CI to catch drift early, or `weekly` to automate the full cycle.

---

## What it catches

| Finding | Severity | Example |
|---------|----------|---------|
| Missing `repository` in package.json | RED | npm page shows no "Repository" link |
| Missing `homepage` | RED | No link to docs or landing page |
| Missing `bugs.url` | YELLOW | No issue tracker link on npm |
| Missing keywords | YELLOW | Package invisible to search |
| Stale README header | YELLOW | No logo, no badges, wrong links |
| GitHub description/homepage mismatch | YELLOW | Repo "About" doesn't match registry |
| NuGet missing PackageProjectUrl | YELLOW | NuGet page has no homepage |
| Tag/release version mismatch | RED | Published v1.2.0 but tag says v1.1.0 |

## What it fixes

Seven built-in fixers apply allowlisted metadata corrections:

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| Fixer | What it does |
|-------|-------------|
| `npm-repository` | Sets `repository` in package.json |
| `npm-homepage` | Sets `homepage` in package.json |
| `npm-bugs` | Sets `bugs.url` in package.json |
| `npm-keywords` | Adds starter keywords to package.json |
| `readme-header` | Adds logo + links to README.md |
| `github-about` | Sets description/homepage via GitHub API |
| `nuget-csproj` | Adds PackageProjectUrl/RepositoryUrl to .csproj |

## Publish with receipts

Every publish generates an immutable JSON receipt with commit SHA, registry version, artifact hashes, and timestamps.

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## The weekly pipeline

Run the full cycle in one command — audit, fix, and optionally publish:

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## Setting up your manifest

After `init`, edit `profiles/manifest.json` to declare your packages:

```json
{
  "npm": [
    { "name": "@yourscope/my-tool", "repo": "your-org/my-tool", "audience": "front-door" }
  ],
  "pypi": [
    { "name": "my-tool", "repo": "your-org/my-tool", "audience": "front-door" }
  ],
  "nuget": [
    { "name": "MyTool.Core", "repo": "your-org/my-tool", "audience": "internal" }
  ]
}
```

**Audience** controls strictness:
- `front-door` — public-facing. Requires clean metadata, tag + release, proper README.
- `internal` — support package. Tag required, README optional.

## Optional: assets plugin

Core is zero-dependency. Visual updates (logos, icons) are handled by an optional plugin:

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## Environment variables

Only needed for publish or API-based fixes:

| Target | Env var | Notes |
|--------|---------|-------|
| npm | `NPM_TOKEN` | Granular token with publish rights |
| NuGet | `NUGET_API_KEY` | Works in CI or locally |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | For releases, issues, GHCR |
| PyPI | `PYPI_TOKEN` | For PyPI publishing |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Clean — no drift found |
| `2` | RED-severity drift detected |
| `3` | Configuration or schema error |
| `4` | Missing credentials |
| `5` | Publish failed |
| `6` | Fix failed |

## Receipts

Every operation (audit, fix, publish, assets) writes an immutable JSON receipt to `receipts/`. Each includes commit SHA, timestamps, artifact SHA-256 hashes, and registry URLs. Verify any receipt:

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## Security

| Aspect | Detail |
|--------|--------|
| **Reads** | Package manifests, registry APIs (npm, NuGet, PyPI) |
| **Writes** | Receipt files to user-specified paths only |
| **Network** | Registry API queries — read-only unless publishing |
| **Telemetry** | None. No analytics, no phone-home. |

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
