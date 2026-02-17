# Phase 1 Fixes Report

> Generated: 2026-02-17 | Registry-truth remediation

## Summary

| Category | Before | After | Notes |
|----------|--------|-------|-------|
| npm published-not-tagged (RED) | 16 of 19 | 0 of 19 | All 16 tagged + 6 pre-tagged for pending publishes |
| NuGet repos with zero tags (RED) | 7 repos | 0 repos | 5 repos tagged (build-governor, Attestia-Desktop, CursorAssist, MouseTrainer, CodeClone-Desktop) |
| npm wrong repo URLs (RED) | 3 packages | 0 | All 3 published with correct org URLs. Unscoped `venvkit` deprecated. |
| npm HTML description (RED) | 1 package | 0 | voice-engine-dsp v0.0.2 published |
| npm missing README (YELLOW) | 3 packages | 0 | pathway v0.2.2, a11y-ci v0.2.2, physics-svg v0.1.1 published |
| Tags without GitHub Releases (YELLOW) | 7 repos | 0 front-door | 8 releases created for front-door packages |
| Soundboard.Client projectUrl (YELLOW) | missing | source fixed | PackageProjectUrl added; takes effect on next NuGet publish |

## Tags Created (22 total)

### npm drift tags (16)

| Repo | Tag | Commit | Confidence |
|------|-----|--------|------------|
| websketch-cli | v0.3.0 | 291c126c | high |
| websketch-ir | v0.3.0 | 3a039339 | high |
| websketch-ir | v0.3.1 | 1198f5c7 | high |
| mcp-tool-registry | v1.0.1 | 2764f86b | high |
| pathway | v0.2.0 | c50aba61 | high |
| pathway | v0.2.1 | 056ef34d | high |
| prov-engine-js | v0.2.1 | bf0f6db9 | high |
| mcp-file-forge | v0.1.0 | ec3d0fdd | high |
| mcp-voice-soundboard | v0.1.2 | 9a44c681 | high |
| accessibility-suite | v0.1.0 | 5c3d90f3 | high |
| accessibility-suite | v0.2.1 | 3b696572 | high |
| siege-kit | v0.1.0 | b241dba0 | high |
| mcp-voice-engine | v0.0.1 | a651c320 | high |
| venvkit | v0.2.0 | fdc0c8fb | high |
| a11y-evidence-engine | v0.3.0 | efe4477e | high |
| a11y-mcp-tools | v0.4.0 | 49100e27 | high |

### NuGet zero-tag repos (5)

| Repo | Tag | Commit | Confidence |
|------|-----|--------|------------|
| build-governor | v1.0.0 | 538cb4fe | high |
| Attestia-Desktop | v1.0.0 | cd64ff96 | high |
| CursorAssist | v1.0.0 | 2e96a2a7 | high |
| MouseTrainer | v1.0.0 | d94b5b21 | high |
| CodeClone-Desktop | v1.0.0 | 633ede9d | high |

### Pre-tags for pending metadata-fix publishes (6)

| Repo | Tag | Commit | Purpose |
|------|-----|--------|---------|
| mcp-voice-engine | v0.0.2 | 7d33c6d | description fix |
| pathway | v0.2.2 | 9999bcf | README fix |
| accessibility-suite | v0.2.2 | 4c7ff06 | README fix |
| siege-kit | v0.1.1 | 465b322 | README fix |
| a11y-evidence-engine | v0.3.1 | b5d87ccb | repo URL fix |
| a11y-mcp-tools | v0.4.1 | 589602b9 | repo URL fix |

## GitHub Releases Created (8)

| Repo | Tag | Status |
|------|-----|--------|
| ConsensusOS | v1.0.0 | created |
| venvkit | v0.2.0 | created |
| mcp-tool-registry | v1.0.0 | created |
| websketch-cli | v0.3.0 | created |
| websketch-ir | v0.3.1 | created |
| pathway | v0.2.1 | created |
| prov-engine-js | v0.2.1 | created |
| mcp-file-forge | v0.1.0 | created |

## Source Fixes (committed + pushed, pending npm publish)

### Repo URL fixes (1D)

| Package | Old URL | New URL | New Version |
|---------|---------|---------|-------------|
| @mcptoolshop/a11y-evidence-engine | mcp-tool-shop/... | mcp-tool-shop-org/... | 0.3.1 |
| @mcptoolshop/a11y-mcp-tools | mcp-tool-shop/... | mcp-tool-shop-org/... | 0.4.1 |

### Description fix (1E)

| Package | Fix | New Version |
|---------|-----|-------------|
| @mcptoolshop/voice-engine-dsp | Added explicit description field | 0.0.2 |

### README fixes (1F)

| Package | Fix | New Version |
|---------|-----|-------------|
| @mcptoolshop/pathway | Created npm/README.md | 0.2.2 |
| @mcptoolshop/a11y-ci | Created src/a11y-ci/npm/README.md | 0.2.2 |
| @mcptoolshop/physics-svg | Created README.md + added to files array | 0.1.1 |

### NuGet metadata fix (1H)

| Package | Fix | Status |
|---------|-----|--------|
| Soundboard.Client | Added PackageProjectUrl to csproj | Source fixed; takes effect on next NuGet version |

## Publishes Completed (2026-02-17)

All 6 metadata-fix packages published successfully:

| Package | Version | Fix | Status |
|---------|---------|-----|--------|
| @mcptoolshop/a11y-evidence-engine | 0.3.1 | repo URL → org | published |
| @mcptoolshop/a11y-mcp-tools | 0.4.1 | repo URL → org | published |
| @mcptoolshop/voice-engine-dsp | 0.0.2 | plain-text description | published |
| @mcptoolshop/pathway | 0.2.2 | README added | published |
| @mcptoolshop/a11y-ci | 0.2.2 | README added | published |
| @mcptoolshop/physics-svg | 0.1.1 | README + files fix | published |

### venvkit resolved

- **@mcptoolshop/venvkit** v0.2.1 published from reconciled `main`
- Merged `feat/audit-improvements` → `main` (scoped identity wins, Docker/GHCR preserved)
- Dependabot fixed to monthly/grouped/limit-3 per CLAUDE.md rules
- Unscoped `venvkit` deprecated on npm: "Use @mcptoolshop/venvkit instead"
- Tag v0.2.1 + GitHub Release created

## Repos re-archived

- mcp-tool-shop-org/a11y-evidence-engine — re-archived after tagging + URL fix
- mcp-tool-shop-org/a11y-mcp-tools — re-archived after tagging + URL fix
