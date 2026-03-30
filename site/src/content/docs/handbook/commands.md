---
title: Commands
description: Full CLI reference for every mcpt-publishing command.
---

## Global flags

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help for the command |
| `--version` | `-v` | Print version and exit |
| `--json` | `-j` | JSON output to stdout |
| `--config <path>` | `-c` | Path to publishing.config.json |

## init

Scaffold a new mcpt-publishing project.

```bash
npx mcpt-publishing init
npx mcpt-publishing init --dry-run    # preview without writing
npx mcpt-publishing init --force      # overwrite existing files
```

Creates `publishing.config.json`, `profiles/manifest.json`, and `receipts/` + `reports/` directories.

## audit

Audit all declared packages against their registries and GitHub state.

```bash
npx mcpt-publishing audit
npx mcpt-publishing audit --json
npx mcpt-publishing audit --repo owner/name         # filter to one repo
npx mcpt-publishing audit --target npm               # filter to one ecosystem
npx mcpt-publishing audit --severity RED             # only RED findings
npx mcpt-publishing audit --skip-gray                # hide cosmetic findings
npx mcpt-publishing audit --quiet                    # suppress per-ecosystem output
```

| Flag | Short | Description |
|------|-------|-------------|
| `--repo <owner/name>` | `-r` | Filter to packages from this repo |
| `--target <ecosystem>` | `-t` | Filter to npm, nuget, pypi, or ghcr |
| `--severity <level>` | | Only show RED, YELLOW, GRAY, or INFO findings |
| `--skip-gray` | | Hide GRAY (cosmetic) findings |
| `--quiet` | | Suppress progress output |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Clean -- no RED findings |
| `2` | RED-severity drift detected |
| `3` | Configuration error |

## fix

Apply metadata fixes based on the latest audit findings.

```bash
npx mcpt-publishing fix --dry-run                    # preview changes
npx mcpt-publishing fix                               # apply locally
npx mcpt-publishing fix --remote                      # apply via GitHub API
npx mcpt-publishing fix --pr                           # create a PR with fixes
npx mcpt-publishing fix --repo owner/name             # fix one repo only
npx mcpt-publishing fix --target npm                   # fix one ecosystem only
```

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Show what would change without applying |
| `--repo <owner/name>` | `-r` | Filter to one repo |
| `--target <ecosystem>` | `-t` | Filter to one ecosystem |
| `--remote` | | Apply via GitHub API instead of local files |
| `--pr` | | Create a PR branch with all fixes |

## publish

Publish packages to their registries with immutable receipts.

```bash
npx mcpt-publishing publish --target npm
npx mcpt-publishing publish --target npm --dry-run
npx mcpt-publishing publish --target npm --repo owner/name
```

Requires environment variables: `NPM_TOKEN`, `NUGET_API_KEY`, `PYPI_TOKEN`, or `GITHUB_TOKEN` depending on the target.

## weekly

Run the full audit-fix cycle in one command.

```bash
npx mcpt-publishing weekly --dry-run     # preview the full cycle
npx mcpt-publishing weekly               # audit + fix
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # audit + fix + publish
```

This is the primary CI automation command. It runs audit, applies fixes, and optionally publishes -- all with receipts.

## verify-receipt

Verify the integrity of any receipt file.

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01-10-30-00.json
npx mcpt-publishing verify-receipt receipts/publish/org--pkg/npm/1.0.0.json --json
```

Checks: file exists, valid JSON, schema-valid, SHA-256 integrity hash.

## providers

List registered audit/publish providers.

```bash
npx mcpt-publishing providers
npx mcpt-publishing providers --json
```

## assets (optional plugin)

Requires `@mcptoolshop/mcpt-publishing-assets`:

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets doctor      # verify sharp is installed
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```
