---
title: mcpt-publishing
description: Multi-registry publishing auditor for npm, PyPI, NuGet, and GHCR.
---

**mcpt-publishing** is a zero-dependency CLI that audits your published packages across registries, detects drift, fixes it, and issues immutable receipts proving what happened.

## The problem

You publish to npm, PyPI, and NuGet. Over time, registry metadata drifts: stale descriptions, missing homepage links, tags that don't match releases, README headers without logos. Nobody notices until a user files a confused bug report because the "Repository" link on npm leads nowhere.

## What mcpt-publishing does

1. **Audits** every package in your manifest against its registry and GitHub state
2. **Reports** findings at RED / YELLOW / GRAY severity with actionable fix hints
3. **Fixes** metadata drift via local edits, GitHub API, or PR
4. **Publishes** with immutable receipts (commit SHA, artifact hashes, timestamps)
5. **Automates** the full cycle with the `weekly` command for CI

## Key design decisions

- **Zero runtime dependencies** -- the core CLI needs only Node 22+
- **Manifest-driven** -- declare packages once, audit/fix/publish from a single source of truth
- **Receipt-first** -- every operation leaves a cryptographically verifiable JSON receipt
- **Audience-aware** -- `front-door` packages get stricter checks than `internal` ones

## Quick links

- [Getting Started](/mcpt-publishing/handbook/getting-started/) -- install, init, first audit
- [Commands](/mcpt-publishing/handbook/commands/) -- full CLI reference
- [Fixers](/mcpt-publishing/handbook/fixers/) -- what each fixer does and when it runs
- [Receipts & Verification](/mcpt-publishing/handbook/receipts/) -- the trust layer
- [CI Integration](/mcpt-publishing/handbook/ci/) -- weekly pipeline, GitHub Actions
