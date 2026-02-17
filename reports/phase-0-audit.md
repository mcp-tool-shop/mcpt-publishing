# Phase 0 Audit Report

> Generated: 2026-02-17 | Audit-only — no changes made

## Top 10 Actions (Priority Order)

1. **RED** — 3 npm packages have repo URLs pointing to personal account instead of org
2. **RED** — 7 repos with published NuGet packages have ZERO git tags
3. **RED** — 1 npm package has HTML in its description field (voice-engine-dsp)
4. **RED** — Multiple npm versions published without matching git tags
5. **YELLOW** — 3 npm packages have no README rendering on npmjs.com
6. **YELLOW** — 7 repos with published packages have ZERO GitHub Releases
7. **YELLOW** — 1 NuGet package (Soundboard.Client) has no projectUrl set
8. **YELLOW** — 2 deprecated npm packages still listed (a11y-evidence-engine, a11y-mcp-tools)
9. **GRAY** — 19 of 21 NuGet packages are at v1.0.0 only (no drift, but no evolution)
10. **GRAY** — No NuGet packages have icons or rendered READMEs (all internal, low priority)

---

## 1. Version Drift

### npm — Published but Not Tagged (RED)

| Package | Registry Version | Latest Tag | Gap |
|---------|-----------------|------------|-----|
| @mcptoolshop/websketch | 0.3.0 | v0.2.0 | 0.3.0 not tagged |
| @mcptoolshop/websketch-ir | 0.3.1 | v0.2.0 | 0.3.0, 0.3.1 not tagged |
| @mcptoolshop/mcp-tool-registry | 1.0.1 | v1.0.0 | 1.0.1 not tagged |
| @mcptoolshop/voice-soundboard-mcp | 0.1.2 | v2.5.0 | Tag scheme mismatch (monorepo) |
| @mcptoolshop/voice-soundboard-core | 0.1.2 | v2.5.0 | Tag scheme mismatch (monorepo) |
| @mcptoolshop/mcpt | 1.0.1 | v1.0.3 | Tag v1.0.3 > registry 1.0.1 — tag ahead? |
| @mcptoolshop/pathway | 0.2.1 | v0.1.0 | 0.2.0, 0.2.1 not tagged |
| @mcptoolshop/venvkit | 0.2.0 | v0.1.0 | 0.2.0 not tagged |
| @mcptoolshop/a11y-evidence-engine | 0.3.0 | v0.1.0 | 0.2.0, 0.3.0 not tagged |
| @mcptoolshop/a11y-mcp-tools | 0.4.0 | v0.1.0 | 0.2.0–0.4.0 not tagged |
| @mcptoolshop/a11y-ci | 0.2.1 | v0.1.0-monorepo | Completely different scheme |
| @mcptoolshop/prov-engine-js | 0.2.1 | v0.2.0 | 0.2.1 not tagged |
| @mcptoolshop/physics-svg | 0.1.0 | (none) | No tags at all |
| @mcptoolshop/voice-engine-dsp | 0.0.1 | v1.0.0 | Tag scheme mismatch |
| @mcptoolshop/synthesis | 0.1.0 | v0.1.0 | **CLEAN** |
| @mcptoolshop/file-forge | 0.1.0 | (none) | No tags at all |
| @mcptoolshop/accessibility-suite | 0.1.0 | v0.1.0-monorepo | Close but not exact |
| @mcptoolshop/consensus-os | 1.0.0 | v1.0.0 | **CLEAN** |
| @mcptoolshop/promo-kit | 0.1.3 | v0.1.3 | **CLEAN** |

**Clean:** 3 of 19 (synthesis, consensus-os, promo-kit)
**Drifted:** 16 of 19

### NuGet — Published but Not Tagged (RED)

| Package | Registry Version | Tags in Repo | Status |
|---------|-----------------|--------------|--------|
| Soundboard.Client | 1.1.0 | v1.1.0, v1.0.0 | **CLEAN** |
| Soundboard.Maui.Audio | 1.0.0 | v1.0.0 | **CLEAN** |
| InControl.Core | 1.2.0 | v1.4.0, v1.2.0, v1.1.0 | **CLEAN** |
| InControl.Inference | 1.0.0 | (shared tags) | Covered by InControl tags |
| Gov.Protocol | 1.0.0 | (none) | **NO TAGS** |
| Gov.Common | 1.0.0 | (none) | **NO TAGS** |
| Attestia.Core | 1.0.0 | (none) | **NO TAGS** |
| Attestia.Client | 1.0.0 | (none) | **NO TAGS** |
| Attestia.Sidecar | 1.0.0 | (none) | **NO TAGS** |
| CursorAssist.Canon | 1.0.0 | (none) | **NO TAGS** |
| CursorAssist.Trace | 1.0.0 | (none) | **NO TAGS** |
| CursorAssist.Engine | 1.0.0 | (none) | **NO TAGS** |
| CursorAssist.Policy | 1.0.0 | (none) | **NO TAGS** |
| MouseTrainer.Domain | 1.0.0 | (none) | **NO TAGS** |
| MouseTrainer.Simulation | 1.0.0 | (none) | **NO TAGS** |
| MouseTrainer.Audio | 1.0.0 | (none) | **NO TAGS** |
| RunForgeDesktop.Core | 1.0.0 | v0.5.0 (app tag) | No package-specific tag |
| CodeClone.Domain | 1.0.0 | (none) | **NO TAGS** |
| LinuxDevTyper.Core | 1.0.0 | v1.0.0 (app tag) | Likely covered |
| DevOpTyper.Content | 1.0.0 | v1.0.0 | **CLEAN** |
| VortexKit | 1.0.0 | v1.2.0 (app tag) | No package-specific tag |

**Clean:** ~5 of 21
**No tags at all:** 7 repos (build-governor, Attestia-Desktop, CursorAssist, MouseTrainer, CodeClone-Desktop)

### Tagged but No GitHub Release (YELLOW)

| Repo | Tags | Releases |
|------|------|----------|
| ConsensusOS | v1.0.0 | none |
| venvkit | v0.1.0 | none |
| a11y-evidence-engine | v0.1.0 | none |
| a11y-mcp-tools | v0.1.0 | none |
| linux-dev-typer | 13 tags | none |
| voice-soundboard | v2.0.0 | none |
| mcp-tool-registry | v1.0.0, v0.1.0 | only v0.3.1 release |

---

## 2. Metadata Issues

### npm — Repo URL Pointing to Wrong Account (RED)

| Package | Current URL | Should Be |
|---------|-------------|-----------|
| @mcptoolshop/venvkit | mcp-tool-shop/venvkit | mcp-tool-shop-org/venvkit |
| @mcptoolshop/a11y-evidence-engine | mcp-tool-shop/a11y-evidence-engine | mcp-tool-shop-org/a11y-evidence-engine |
| @mcptoolshop/a11y-mcp-tools | mcp-tool-shop/a11y-mcp-tools | mcp-tool-shop-org/a11y-mcp-tools |

Note: The a11y packages are deprecated (moved to accessibility-suite). The repo URL mismatch
is still a RED because the pointed-to personal repos may not exist or may be stale.

### npm — Broken Description (RED)

| Package | Issue |
|---------|-------|
| @mcptoolshop/voice-engine-dsp | Description contains raw HTML (`<div align="center"><img...>`) instead of text |

### npm — Missing README on Registry (YELLOW)

| Package | Issue |
|---------|-------|
| @mcptoolshop/pathway | No README renders on npmjs.com |
| @mcptoolshop/a11y-ci | No README renders on npmjs.com |
| @mcptoolshop/physics-svg | No README renders on npmjs.com |

### NuGet — Missing projectUrl (YELLOW)

| Package | Issue |
|---------|-------|
| Soundboard.Client | No projectUrl set (v1.0.0 and v1.1.0) |

### NuGet — No Icons (GRAY, informational)

All 21 NuGet packages lack icons. Since all but Soundboard.Client are classified as
internal, this is low priority. Soundboard.Client (front-door) should get an icon in Phase 2.

### NuGet — No Rendered READMEs (GRAY, informational)

None of the 21 NuGet packages include a rendered README in their .nupkg.
Front-door packages should add this in Phase 2.

---

## 3. Identity & Ownership

### npm Scope

- **Scope:** @mcptoolshop
- **Owner:** mikefrilot (sole owner)
- **Status:** CLEAN

### NuGet Owner

- **Owner:** mcp-tool-shop
- **Package count:** 21
- **Status:** CLEAN

### GitHub

- **Org:** mcp-tool-shop-org — all tool repos present
- **Personal:** mcp-tool-shop — 3 repos (marketing site, mcpt-marketing, mcpt-link-fresh) + now mcpt-publishing
- **Status:** CLEAN (repos are in the right places per CLAUDE.md rules)

### Cross-Check Issues

- 3 npm packages point to personal-account repos that should be org (see Metadata section above)
- No NuGet packages point to wrong repos (all projectUrls are correct where present)
- Live site URL: https://mcp-tool-shop.github.io/ — canonical and correct

---

## 4. Front-Door vs Internal Classification

### Front-Door Packages (strangers should find and use these)

**npm (10):**
- @mcptoolshop/mcpt — CLI entry point
- @mcptoolshop/mcp-tool-registry — metadata registry
- @mcptoolshop/websketch — CLI for UI capture
- @mcptoolshop/websketch-ir — grammar for UI representation
- @mcptoolshop/voice-soundboard-mcp — TTS MCP server
- @mcptoolshop/consensus-os — consensus control plane
- @mcptoolshop/synthesis — empathy/trust evaluations
- @mcptoolshop/pathway — workflow automation
- @mcptoolshop/file-forge — file ops MCP server
- @mcptoolshop/accessibility-suite — a11y monorepo root
- @mcptoolshop/venvkit — Python venv diagnostics

**NuGet (1):**
- Soundboard.Client — SDK for soundboard servers

### Internal Packages (dependencies, components, deprecated)

**npm (8):** voice-soundboard-core, a11y-ci, a11y-evidence-engine (deprecated),
a11y-mcp-tools (deprecated), prov-engine-js, voice-engine-dsp, physics-svg, promo-kit

**NuGet (20):** All remaining NuGet packages are internal components of desktop apps.

### Minimum Expectations (Phase 2+)

**Front-door must have:** icon, rendered README on registry, correct metadata (repo/project URLs, description, tags)

**Internal must have:** correct repo URL, one-line description indicating internal status

---

## 5. Monorepo Tag Strategy (Decision Needed)

Several repos publish multiple packages from one repo. Current state is inconsistent:

| Repo | Packages | Current Tags | Recommended |
|------|----------|-------------|-------------|
| mcp-voice-soundboard | mcp, core | v2.5.0 (app-level) | Per-package: `mcp-v0.1.2`, `core-v0.1.2` |
| accessibility-suite | suite, a11y-ci | v0.1.0-monorepo | Per-package or shared |
| siege-kit | physics-svg | none | Tag per package |
| mcp-voice-engine | voice-engine-dsp | v1.0.0 (app-level) | Separate DSP tags |
| soundboard-maui | Client, Maui.Audio | v1.1.0 | Per-package or shared |
| InControl-Desktop | Core, Inference | v1.2.0 | Per-package or shared |
| CursorAssist | Canon, Trace, Engine, Policy | none | Per-package |
| MouseTrainer | Domain, Simulation, Audio | none | Per-package |
| Attestia-Desktop | Core, Client, Sidecar | none | Per-package |
| build-governor | Protocol, Common | none | Per-package |

**Decision deferred to Phase 1.** Phase 0 records the problem.

---

## Definition of Done Checklist

- [x] Inventory file exists and covers all 40 published packages (19 npm + 21 NuGet)
- [x] Each package classified as front-door or internal
- [x] Drift rules written down (registry truth policy in CONTRACT.md)
- [x] mcpt-publishing repo skeleton exists with schema + example profile
- [x] Single place to point to: this file + inventory.md
