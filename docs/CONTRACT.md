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

## Phase 1 — Automated Drift Detection (planned)

- Scripts that re-run the Phase 0 audit programmatically
- Tag reconciliation (add missing tags to match registry reality)
- GitHub Release creation for tagged versions
- CI workflow to run audit on schedule or manual trigger

## Phase 2 — Storefront Hygiene (planned)

- Front-door packages get icons, polished READMEs, correct metadata
- Internal packages get labeled clearly
- Unlist decisions executed
- Registry pages reviewed for rendering quality

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

## Remediation Policy (Phase 1+)

- `published-not-tagged` → add matching `vX.Y.Z` tag
- `source-mismatch` → reconcile source to registry truth
- `tagged-not-released` → optionally create GitHub Release
- `stale` → no action unless chosen
