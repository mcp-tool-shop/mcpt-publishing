# Changelog

All notable changes to `@mcptoolshop/mcpt-publishing-assets` are documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-03-30

### Changed
- Promoted from v0.3.1 to v1.0.0 — package is stable and production-ready.

### Added
- Logo generation pipeline via `sharp` with PNG output.
- Icon resizing to standard sizes (16, 32, 64, 128, 256 px).
- Wire-frame preview generation for repository landing pages.
- Receipt output for every asset operation (SHA-256 hashes, timestamp, artifact list).
- `lib/` directory with modular generators for logo, icon, and wire assets.

## [0.3.1] - 2026-02-15

### Fixed
- Corrected sharp dependency version range to `^0.33.0` for Node 22 compatibility.

## [0.3.0] - 2026-02-10

### Added
- Wire-change tracking: records before/after field values when assets are wired into a project.
- `wireChanges` array written into asset receipts.

## [0.2.0] - 2026-01-20

### Added
- Icon generation support (multi-size PNG export).
- ESM-only package (`"type": "module"`).

## [0.1.0] - 2026-01-05

### Added
- Initial release: logo PNG generation using `sharp`.
- Basic receipt schema (schemaVersion, timestamp, repo, artifacts).
