# Changelog

All notable changes to this project will be documented in this file.

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
