---
title: Getting Started
description: Install mcpt-publishing, set up your manifest, and run your first audit.
---

## Requirements

- **Node.js 22+** (ESM-only)
- **GitHub CLI** (`gh`) -- required for remote fixes and GitHub metadata checks
- No other dependencies

## Install

```bash
# Run directly (recommended)
npx mcpt-publishing audit

# Or install globally
npm i -g @mcptoolshop/mcpt-publishing
```

## Initialize

```bash
npx mcpt-publishing init
```

This creates:
- `publishing.config.json` -- configuration (usually defaults are fine)
- `profiles/manifest.json` -- your package declarations
- `receipts/` -- where immutable receipts are stored
- `reports/` -- where audit reports land

## Set up your manifest

Edit `profiles/manifest.json` to declare your packages:

```json
{
  "npm": [
    {
      "name": "@yourscope/my-tool",
      "repo": "your-org/my-tool",
      "audience": "front-door"
    }
  ],
  "pypi": [
    {
      "name": "my-tool",
      "repo": "your-org/my-tool",
      "audience": "front-door"
    }
  ],
  "nuget": [
    {
      "name": "MyTool.Core",
      "repo": "your-org/my-tool",
      "audience": "internal"
    }
  ]
}
```

### Audience levels

| Audience | Strictness | What it means |
|----------|-----------|---------------|
| `front-door` | High | Public-facing. Requires clean metadata, tag + release, proper README, homepage. |
| `internal` | Normal | Support package. Tag required, but README and metadata are advisory. |

## Run your first audit

```bash
npx mcpt-publishing audit
```

The audit checks every package against its registry (npm, PyPI, NuGet) and GitHub state. Findings are written to `reports/latest.md` and a receipt is stored in `receipts/audit/`.

### Filter by repo or ecosystem

```bash
npx mcpt-publishing audit --repo your-org/my-tool
npx mcpt-publishing audit --target npm
npx mcpt-publishing audit --severity RED
```

### JSON output for CI

```bash
npx mcpt-publishing audit --json
```

## Preview and apply fixes

```bash
# See what would change
npx mcpt-publishing fix --dry-run

# Apply locally
npx mcpt-publishing fix

# Apply via GitHub API (no local clone needed)
npx mcpt-publishing fix --remote

# Open a PR with all fixes
npx mcpt-publishing fix --pr
```

## Next steps

- [Commands reference](/mcpt-publishing/handbook/commands/) for the full CLI
- [CI Integration](/mcpt-publishing/handbook/ci/) to automate with GitHub Actions
