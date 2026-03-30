---
title: Fixers
description: What each built-in fixer does, when it triggers, and how to extend them.
---

mcpt-publishing ships nine built-in fixers that apply allowlisted metadata corrections. Fixers only edit metadata fields -- they never modify source code or business logic.

## How fixers work

1. **Audit** finds a drift issue (e.g., `missing-homepage` on npm)
2. **Fixer matching** -- each fixer declares which finding codes it handles via `canFix()`
3. **Diagnose** -- the fixer reads the current state and determines if a fix is needed
4. **Apply** -- the fixer writes the corrected value (locally, via API, or as a PR)
5. **Receipt** -- the fix is recorded with before/after values

### Execution modes

| Mode | Flag | How it works |
|------|------|-------------|
| Local | (default) | Edits files on disk |
| Remote | `--remote` | Reads/writes via GitHub Contents API |
| PR | `--pr` | Creates a branch, commits, pushes, opens PR |
| Dry-run | `--dry-run` | Shows what would change, writes nothing |

## Built-in fixers

### npm-repository

**Triggers on:** `wrong-repo-url` (RED)

Sets the `repository` field in `package.json` to point to the correct GitHub repo. Handles both `https://` and `git+https://` URL formats.

### npm-homepage

**Triggers on:** `missing-homepage` with ecosystem `npm`

Sets the `homepage` field in `package.json` to the repo's landing page URL.

### npm-bugs

**Triggers on:** `missing-bugs-url` (YELLOW)

Sets `bugs.url` in `package.json` to `https://github.com/{org}/{repo}/issues`.

### npm-keywords

**Triggers on:** `missing-keywords` (YELLOW)

Adds starter keywords to `package.json` derived from the package name and description.

### npm-description

**Triggers on:** `bad-description` (RED)

Cleans and sets the `description` field in `package.json`. Strips HTML artifacts and collapses whitespace.

### readme-header

**Triggers on:** `missing-readme` (YELLOW/GRAY)

Adds a branded logo and badge header to `README.md`. Skips repos where the README doesn't exist (can't create files).

### github-about

**Triggers on:** `missing-homepage` with ecosystem `github`

Sets the GitHub repo's description and homepage via `gh api`. Only fires when the repo's "About" section on GitHub has no homepage set.

### nuget-csproj

**Triggers on:** `missing-project-url` (YELLOW)

Adds `<PackageProjectUrl>` and `<RepositoryUrl>` to the first `.csproj` file found. Handles both local files and remote via GitHub API.

### git-tag-missing (diagnostic)

**Triggers on:** `published-not-tagged` (RED)

This is a diagnostic-only fixer. It cannot safely create tags automatically (needs human judgment on which commit to tag). Instead, it prints the exact command:

```
git tag v1.2.3 && git push origin v1.2.3
```

## Adding a new fixer

See [CONTRIBUTING.md](https://github.com/mcp-tool-shop/mcpt-publishing/blob/main/CONTRIBUTING.md) for the full guide. In brief:

1. Create `src/fixers/fixers/my-fixer.mjs` extending the `Fixer` base class
2. Set `code`, `target`, and implement `canFix()`, `diagnose()`, `applyLocal()`, `applyRemote()`
3. The fixer is auto-discovered by the registry -- no manual registration needed
4. Add tests in `scripts/test-providers.mjs`
