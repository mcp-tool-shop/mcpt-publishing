# Contributing to mcpt-publishing

Thank you for your interest in contributing. This guide covers the four most common contribution types: adding a provider, adding a fixer, running tests, and submitting a PR.

---

## Development setup

```bash
git clone https://github.com/mcp-tool-shop/mcpt-publishing.git
cd mcpt-publishing
npm ci
npm test
```

Node >= 22 required. The package has zero runtime dependencies — keep it that way.

---

## Adding a new provider

Providers are audit engines for a specific registry. The existing providers live in `src/audit/`.

1. Create `src/audit/<registry>.mjs` — export a class with at minimum:
   - `get name()` — short registry name (e.g. `"rubygems"`)
   - `async audit(profile)` — returns an array of findings: `{ severity, code, msg, field?, actual?, expected? }`

2. Register the provider in `src/audit/loader.mjs` by adding it to the provider map.

3. Add at least one test case in `scripts/test-providers.mjs` covering the new provider's core finding codes.

4. Document the new finding codes in `docs/CONTRACT.md` under the relevant registry section.

Severity levels: `"RED"` (blocking drift) | `"YELLOW"` (recommended) | `"INFO"` (advisory).

---

## Adding a new fixer

Fixers are allowlisted metadata corrections. They live in `src/fixers/fixers/`.

1. Create `src/fixers/fixers/<name>.mjs`. Extend the `Fixer` base class from `src/fixers/fixer.mjs`:

   ```js
   import { Fixer } from '../fixer.mjs';

   export class MyFixer extends Fixer {
     get code() { return 'my-fixer-code'; }
     get target() { return 'npm'; } // 'npm' | 'nuget' | 'readme' | 'github'

     canFix(finding) { return finding.code === 'MY_FINDING_CODE'; }

     async applyLocal(profile, finding) {
       // Edit files on disk. Return { changed: true, detail: '...' }
     }
   }
   ```

2. Register the fixer in `src/fixers/registry.mjs`.

3. Update the fixer table in `site/src/site-config.ts` (the data-table section) and in `README.md`.

4. Add tests in `scripts/test-providers.mjs` that verify the fixer handles its target finding.

**Hard rule:** fixers may only touch metadata fields (descriptions, URLs, tags). No source code changes, no version bumps, no publish calls.

---

## Running tests

```bash
# Full test suite (provider tests + version consistency)
npm test

# Provider tests only
node scripts/test-providers.mjs

# Version consistency only
node tests/version.test.mjs

# Verify tarball contents
npm pack --dry-run
```

CI runs `npm test` on every push that touches `src/**`, `scripts/**`, `tests/**`, or `package.json`.

---

## PR acceptance criteria

Before opening a PR, ensure all of the following are true:

- `npm test` exits 0
- `npm pack --dry-run` includes all required files (`bin/`, `src/`, `README.md`, `CHANGELOG.md`, `LICENSE`)
- New code follows the existing pattern (ESM modules, no runtime dependencies added without discussion)
- New providers or fixers include tests
- `CHANGELOG.md` is updated under `[Unreleased]`
- No secrets, tokens, or hardcoded credentials in any file

---

## Release process

Releases are handled by the maintainer. The process is:

1. Bump version in `package.json` (follows semver, minimum v1.0.0)
2. Move `[Unreleased]` items in `CHANGELOG.md` to a dated version section
3. Create and push a git tag matching the version: `git tag v1.x.x && git push --tags`
4. GitHub Actions `publish.yml` triggers on `release: published`, runs tests + tarball verification, then publishes to npm with provenance

Contributors do not need to manage releases — that is maintainer responsibility.
