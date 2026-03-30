# Publishing Contract

## Phase 0 — Audit Only

**Goal:** Make reality visible and reproducible before automating anything.

**Rules:**
- No publishing
- No auto-tagging
- No PR-writing
- No "fixes" beyond producing the report and the plan

**Output:** For every repo/package, answer:
- What's published?
- What's true?
- What's wrong?
- What do we do next?

**Deliverables:**
- `inventory.md` — complete map of all published artifacts
- `reports/phase-0-audit.md` — drift + metadata + identity report
- `profiles/` — one profile per shipping repo
- `schemas/profile.schema.json` — machine-readable profile contract

## Phase 1 — Registry Truth Sync (complete)

- All published npm/NuGet versions tagged in git
- Metadata fixes published (repo URLs, descriptions, READMEs)
- GitHub Releases created for front-door packages
- 7 npm metadata-fix publishes, 25 git tags, 12 GitHub Releases

## Phase 2 — Automated Audit + Storefront (complete)

- `scripts/audit.mjs` — automated drift detection with severity engine
- Weekly GitHub Action updates a pinned "Publishing Health" issue
- Front-door NuGet packages get icons + rendered READMEs
- Release strategy locked (see below)

## Phase 3 — Storefront Professionalism (complete)

- All repos have logo, README header, LICENSE, homepage, topics
- RED=0, YELLOW=0 across 26 repos

## Phase 4 — Fixers + Automation (complete)

- Seven built-in fixers implemented: `npm-repository`, `npm-homepage`, `npm-bugs`, `npm-keywords`, `readme-header`, `github-about`, `nuget-csproj`
- `fix --dry-run` preview mode, `fix --remote` (GitHub API), `fix --pr` (open PR with changes)
- Weekly pipeline command: `weekly --dry-run | --pr | --publish`
- GitHub Action for weekly automated audit + fix cycle

## Phase 5 — Multi-Registry Publishing + GitHub Glue + Receipts (current)

- **Provider plugin system:** `scripts/lib/provider.mjs` base class with `detect()`, `audit()`, `plan()`, `publish()`, `receipt()` methods
- **Auto-discovery:** `scripts/lib/registry.mjs` scans `providers/*.mjs`, validates interface compliance
- **Extracted providers:** npm, NuGet, GitHub (context loader) — logic extracted verbatim from audit.mjs
- **New providers:** PyPI (pypi.org JSON API), GHCR (GitHub Packages API via `gh api`)
- **Receipt system:** `schemas/receipt.schema.json` + `scripts/lib/receipt-writer.mjs` — immutable JSON receipts at `receipts/publish/<owner>--<name>/<target>/<version>.json`
- **GitHub Glue:** `scripts/lib/github-glue.mjs` — attaches receipts to releases, updates health issue
- **Refactored audit.mjs:** thin orchestrator that loads providers, iterates manifest, delegates to providers — output format unchanged
- Adding a new registry = drop a single `.mjs` file in `scripts/lib/providers/`

### Receipt Schema (v1.0.0)

Required fields: `schemaVersion`, `repo` (owner/name), `target` (npm|nuget|pypi|ghcr), `version`, `packageName`, `commitSha` (40-hex), `timestamp` (ISO 8601), `artifacts[]` (name, sha256, size, url). Optional: `metadata{}`.

### Receipt Immutability

Receipts are append-only. Once `receipts/publish/<slug>/<target>/<version>.json` is written, it cannot be overwritten. The receipt writer enforces this at the filesystem level.

## Registry Truth Policy

Published npm/NuGet versions are **immutable reality**. We never:
- Unpublish to "fix" a version (npm won't let you anyway)
- Pretend a published version doesn't exist
- Override registry state with local state

Instead, we reconcile everything else (tags, releases, source files) to match.

## Drift Categories

| Category | Meaning | Severity |
|----------|---------|----------|
| `published-not-tagged` | Registry has version X, repo tag missing | RED |
| `tagged-not-released` | Tag exists, GitHub Release missing | YELLOW |
| `source-mismatch` | Source claims version Y, registry latest is X | RED |
| `stale` | Everything consistent but old | GRAY |

## Remediation Policy

- `published-not-tagged` → add matching `vX.Y.Z` tag
- `source-mismatch` → reconcile source to registry truth
- `tagged-not-released` → create GitHub Release (front-door required, internal optional)
- `stale` → no action unless chosen

## Release Strategy (locked)

### Tag format
- All packages: `vX.Y.Z` (semver with `v` prefix)
- Monorepos with multiple packages at the same version: single `vX.Y.Z` tag
- Monorepos where packages version independently: deferred to Phase 3 (use per-package prefixes)

### Publishing rule
Every `npm publish` or `dotnet nuget push` MUST have a matching git tag created
immediately after (or before, if tag-driven). The audit script flags violations as RED.

### Front-door packages
- Tag required
- GitHub Release required
- README must render on registry page
- Correct repo/project URLs required

### Internal packages
- Tag required
- GitHub Release optional
- README optional (GRAY if missing)
- Correct repo URL required

## Ecosystem Receipt and Publish Capabilities

Which ecosystems support automated publishing and receipt generation.

| Ecosystem | Target ID | Receipt Support | Publish Automation | Artifact URL | Notes |
|-----------|-----------|----------------|-------------------|--------------|-------|
| npm | `npm` | Yes | Yes | `https://registry.npmjs.org/<pkg>/-/<pkg>-<ver>.tgz` | Full receipt with tarball sha256 |
| NuGet | `nuget` | Yes | Yes | `https://www.nuget.org/api/v2/package/<pkg>/<ver>` | Full receipt with .nupkg sha256 |
| PyPI | `pypi` | Yes | Yes | `https://files.pythonhosted.org/packages/...` | Full receipt; sdist + wheel artifacts |
| GHCR | `ghcr` | Yes | Yes | `ghcr.io/<owner>/<image>:<version>` | Full receipt; image digest as sha256 |
| GitHub Releases | `github` | Partial | No (context loader only) | GitHub Release asset URL | Read-only provider; used as context for other providers |
| Smithery | `smithery` | Planned | Planned | — | Deployment target; receipt spec not yet finalized |
| Fly.io | `flyio` | Planned | Planned | — | Deployment target; receipt spec not yet finalized |

### Receipt coverage by ecosystem

- **Full** (npm, NuGet, PyPI, GHCR): receipt written to `receipts/publish/<owner>--<name>/<target>/<version>.json`, artifact hash recorded, schema-validated before write.
- **Partial** (GitHub): provider loads context (releases, tags) to support other providers — does not write a receipt itself.
- **Planned** (Smithery, Fly.io): provider stubs exist; receipt schema for deployment targets (`fly` deploy ID, `smithery` deployment hash) will be added in Phase 6.

## Future

### Phase 6 — Deployment Target Receipts

- Finalize receipt schema fields for Smithery and Fly.io deployment targets
- Smithery provider: deployment hash, tool manifest snapshot, registry link
- Fly.io provider: deployment ID, image digest, region list
- `schemaVersion` bump in `receipt.schema.json` and `profile.schema.json`
- CLI command: `mcpt-publishing verify-deployment` for non-package targets

### Phase 7 (Planned)

- Multi-profile workspace commands (batch audit, batch fix across all profiles)
- Dashboard site enhancements: trend charts, SLA timers for stale packages
- Signed receipts (cosign / Sigstore integration for artifact attestation)

## Deprecation Policy

Fields and commands follow a two-phase deprecation cycle:

1. **Soft deprecation** — the item is marked `@deprecated` in schema descriptions and the CLI emits a warning. Supported for at least one minor release after the warning appears.
2. **Hard removal** — the item is removed in the next major version bump. A migration note is added to `CHANGELOG.md` and this contract.

Deprecated receipt schema fields are never removed from already-written receipts (receipts are immutable). New receipts omit deprecated fields and use their replacements.

Schema `schemaVersion` is bumped on every breaking change. The CLI accepts receipts one major version behind current to ease rollover.
