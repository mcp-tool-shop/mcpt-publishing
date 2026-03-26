# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] - 2026-03-25

### Security

- SHA-pinned all GitHub Actions across ci.yml, pages.yml, and publish.yml for supply-chain safety

### Added

- 6 version consistency tests (semver, >= 1.0.0, CHANGELOG, CLI --version, scope, bin entry)
- `tests/**` path trigger in CI workflow

## [1.1.1] - 2026-03-19

### Security

- **Eliminate shell injection surface**: Migrated all `execSync` string-interpolation calls to `execFileSync`/`execArgs` (argument arrays, no shell interpolation) across all providers, fixers, and GitHub glue
- Replaced `curl` shell calls in PyPI and NuGet providers with native `fetch()` (Node 22+)
- Updated SECURITY.md to include v1.1.x in supported versions table

### Fixed

- Silent error swallowing in fixers (`github-about`, `_npm-helpers`) now logs failures to stderr instead of returning silently
- Added `verify` script (`npm audit + npm test`) to package.json for shipcheck gate D compliance

## [1.1.0] - 2026-03-02

### Added

- xrpl-camp and sovereignty-game to manifest (132 total packages)
- PyPI keyword in package.json (was missing despite full PyPI support)
- "Setting up your manifest" section in README with example config

### Changed

- README rewritten for standalone use — no longer reads as internal plumbing
- Package description repositioned: "Multi-registry publishing auditor" instead of "plugin for MCP Tool Shop"
- Removed redundant h1 header (logo already contains the name)
- Inventory updated to 132 packages (62 npm + 27 NuGet + 38 PyPI + 5 VS Code)

## [1.0.0] - 2026-02-27

### Added

- SECURITY.md with scope and response timeline
- SHIP_GATE.md and SCORECARD.md for product audit trail
- Security & Data Scope section in README

### Changed

- Promoted to v1.0.0 stable release (was 0.3.0)

## [0.3.0] - 2026-02-17

### Added
- **fix command**: `mcpt-publishing fix` — allowlisted metadata fixes with local, `--remote`, and `--pr` modes
- **7 fixers**: npm-repository, npm-homepage, npm-bugs, npm-keywords, readme-header, github-about, nuget-csproj
- **Fixer plugin system**: Base `Fixer` class with auto-discovery registry, matching `canFix()` to audit findings
- **weekly command**: `mcpt-publishing weekly` — orchestrates audit → fix → optionally publish in one shot
- **assets command**: `mcpt-publishing assets` — bridges to optional `@mcptoolshop/mcpt-publishing-assets` plugin
- **Assets plugin**: `@mcptoolshop/mcpt-publishing-assets` — logo/icon generation via `sharp` (doctor, logo, wire)
- **Fix receipts**: Immutable JSON receipts for fix operations with schema validation
- **Assets receipts**: Receipt type for asset generation operations
- **CI prepublish gate**: Tarball verification, install smoke test, CLI smoke tests in GitHub Actions
- **Plugin loader**: Auto-discovers optional plugins with install hints
- **Shared audit loop**: Extracted `runAudit()` for reuse by both audit and fix commands
- Exit code 6 (`FIX_FAILURE`) for failed fixes
- `init --dry-run` support
- npm workspace support (`packages/` directory)
- 2 new npm audit findings: `missing-bugs-url`, `missing-keywords`

### Changed
- Version bumped from 0.2.0 to 0.3.0
- Global help rewritten with Golden Path workflow
- README rewritten with fix command, weekly, assets plugin documentation
- CI workflow renamed from `audit-weekly.yml` to `ci.yml` with prepublish gate
- `plan` command deprecated (replaced by `fix --dry-run`)
- Test suite expanded from 42 to 93 tests

## [0.2.0] - 2026-02-17

### Added
- **Real npm publish**: `npm pack` + `npm publish --access public` with SHA-256 receipts
- **Real NuGet publish**: `dotnet pack` + `dotnet nuget push` with SHA-256 receipts
- **verify-receipt command**: Validates receipt files against schema with integrity hash
- **Shell utilities**: Shared `exec`, `hashFile`, `getCommitSha` for providers
- Exit code 5 (`PUBLISH_FAILURE`) for failed publishes
- `--repo`, `--target`, `--cwd`, `--dry-run` flags for publish command
- Pre-flight credential check (fail-fast before any publish starts)
- CHANGELOG.md

### Changed
- Version bumped from 1.0.0 to 0.2.0 (1.0.0 was premature — audit-only)
- Publish command: full orchestrator replacing stub
- Help text updated with verify-receipt, publish flags, env vars
- README updated: publish + verify-receipt marked as real

## [1.0.0] - 2026-02-17

Initial npm publish. Audit-only with CLI skeleton.

### Added
- CLI with subcommands: audit, init, providers, plan (stub), publish (stub)
- Provider plugin system (npm, NuGet, PyPI, GHCR, GitHub)
- Receipt schema v1.0.0 and immutable receipt writer
- Audit command with severity engine (RED/YELLOW/GRAY/INFO)
- Publishing health reports (markdown + JSON)
- GitHub glue (receipt attachment, health issue updates)
- Config system with walk-up discovery
- 28-test smoke suite
- Zero runtime dependencies
