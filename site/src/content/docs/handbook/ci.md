---
title: CI Integration
description: Automate registry audits and fixes with GitHub Actions.
---

mcpt-publishing is designed for CI-first operation. The `weekly` command runs the full audit-fix cycle, and the CLI's exit codes integrate cleanly with GitHub Actions.

## The weekly pipeline

The simplest CI setup runs `weekly` on a schedule:

```yaml
name: Registry Health
on:
  schedule:
    - cron: '0 8 * * 1'  # Every Monday 8am UTC
  workflow_dispatch: {}

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run weekly audit + fix
        run: npx mcpt-publishing weekly
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit report
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add reports/ receipts/
          git diff --staged --quiet && echo 'No changes' && exit 0
          git commit -m "chore: weekly registry audit [skip ci]"
          git push
```

## Exit codes in CI

| Code | Action |
|------|--------|
| `0` | Clean -- all packages healthy |
| `2` | RED drift detected -- fail the check or notify |
| `3` | Config error -- check manifest.json |
| `4` | Missing credentials -- set NPM_TOKEN / GH_TOKEN |

Use exit code 2 as a CI gate:

```yaml
- name: Audit (gate)
  run: npx mcpt-publishing audit
  # Fails the job if any RED findings exist
```

## Filtering in CI

Reduce noise by filtering:

```bash
# Only check npm packages
npx mcpt-publishing audit --target npm

# Only show blocking issues
npx mcpt-publishing audit --severity RED

# Hide cosmetic findings
npx mcpt-publishing audit --skip-gray
```

## JSON output for downstream tools

```bash
npx mcpt-publishing audit --json > audit-results.json
```

The JSON output includes per-package findings with severity, code, message, and fix hints. Use `jq` or a script to extract what you need:

```bash
# Count RED findings
npx mcpt-publishing audit --json | jq '.counts.RED'

# List all RED package names
npx mcpt-publishing audit --json | jq '[.packages[] | select(.findings[] | .severity == "RED") | .name] | unique'
```

## PR-based fixes

For teams that require review before metadata changes:

```bash
npx mcpt-publishing fix --pr
```

This creates a branch, commits all fixes, pushes, and opens a PR. The commit message and branch name are deterministic. Requires `GH_TOKEN` with repo write access.

## Environment variables

| Variable | Required for | Notes |
|----------|-------------|-------|
| `GH_TOKEN` or `GITHUB_TOKEN` | Remote fixes, PR mode, GitHub metadata | Usually available in Actions |
| `NPM_TOKEN` | npm publish | Granular publish token |
| `NUGET_API_KEY` | NuGet publish | From nuget.org API keys |
| `PYPI_TOKEN` | PyPI publish | From pypi.org trusted publishers |

## Receipts in CI

Every audit, fix, and publish writes a receipt. Commit these alongside your reports to build an append-only audit trail:

```yaml
- name: Commit reports + receipts
  run: |
    git add reports/ receipts/
    git diff --staged --quiet || git commit -m "chore: audit [skip ci]" && git push
```

Verify receipts in a separate CI step:

```bash
for r in receipts/publish/**/*.json; do
  npx mcpt-publishing verify-receipt "$r"
done
```
