---
title: Receipts & Verification
description: How mcpt-publishing provides an immutable audit trail with cryptographic verification.
---

Every operation in mcpt-publishing writes an immutable JSON receipt. Receipts are the trust layer -- they prove what happened, when, and to what artifact.

## Receipt types

| Type | Written by | Location |
|------|-----------|----------|
| Audit | `audit` command | `receipts/audit/YYYY-MM-DD-HH-MM-SS.json` |
| Fix | `fix` command | `receipts/fix/{repo}/{timestamp}.json` |
| Publish | `publish` command | `receipts/publish/{owner}--{name}/{target}/{version}.json` |
| Assets | `assets` plugin | `receipts/assets/{timestamp}.json` |

## What a receipt contains

### Publish receipt

```json
{
  "schemaVersion": "1.0.0",
  "type": "publish",
  "timestamp": "2026-03-30T12:00:00Z",
  "repo": { "owner": "mcp-tool-shop-org", "name": "my-tool" },
  "target": "npm",
  "version": "1.2.0",
  "packageName": "@mcptoolshop/my-tool",
  "commitSha": "abc123...",
  "artifacts": [
    { "name": "mcptoolshop-my-tool-1.2.0.tgz", "sha256": "...", "size": 12345 }
  ]
}
```

Key fields:
- **commitSha** -- the exact git commit published (40 or 64 hex chars)
- **artifacts** -- each with a SHA-256 hash and byte size
- **schemaVersion** -- enables future schema evolution

### Audit receipt

Captures RED/YELLOW/GRAY counts, total packages audited, and per-ecosystem breakdown.

### Fix receipt

Records each change with before/after values, the mode (local/remote/pr/dry-run), and whether a post-fix re-audit is pending.

## Immutability

Publish receipts are **write-once**. If you try to write a receipt for a version that already exists, the operation fails with an immutability error. This prevents silent overwrites and ensures the audit trail is append-only.

Audit receipts use timestamped filenames (to the second) so multiple runs per day don't overwrite each other.

## Verification

Verify any receipt with:

```bash
npx mcpt-publishing verify-receipt receipts/publish/org--pkg/npm/1.0.0.json
```

The verifier checks:
1. **File exists** and is readable
2. **Valid JSON** -- parses without error
3. **Schema valid** -- required fields present, types correct, schemaVersion recognized
4. **Integrity** -- SHA-256 hash of the file contents

### JSON output

```bash
npx mcpt-publishing verify-receipt receipt.json --json
```

Returns a structured `{ valid: true/false, checks: [...] }` object for CI integration.

## Receipt index

`receipts/index.json` is a lightweight index tracking the latest audit, publish, and fix operations. It's updated automatically and used by the weekly pipeline and CI reporting.

## Schema evolution

Receipt schemas use major-version checking. Receipts with `schemaVersion: "1.x.y"` (any minor/patch) are accepted by the current validator. A breaking change would bump to `"2.0.0"`.
