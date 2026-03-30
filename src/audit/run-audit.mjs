/**
 * Shared audit loop — runs publishing health audit and returns structured results.
 *
 * Used by both `audit` (to generate reports) and `fix` (to discover fixable drift).
 * Does NOT write reports or emit receipts — callers handle that.
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run the audit loop across all manifest entries.
 *
 * @param {object} config   - Resolved config (from loader.mjs)
 * @param {object} manifest - Parsed manifest ({ npm: [...], nuget: [...], ... })
 * @returns {Promise<{ results: object, allFindings: Array, counts: object }>}
 */
export async function runAudit(config, manifest) {
  // Import provider registry (reuse existing working code in scripts/lib/)
  const registryPath = join(__dirname, "..", "..", "scripts", "lib", "registry.mjs");
  const registryUrl = pathToFileURL(registryPath).href;
  const { loadProviders, matchProviders } = await import(registryUrl);

  const providers = await loadProviders();

  // Optional: filter by enabledProviders config
  const enabled = config.enabledProviders ?? [];
  const activeProviders = enabled.length > 0
    ? providers.filter(p => enabled.includes(p.name))
    : providers;

  // Shared context for tag/release caching and GitHub error tracking.
  // ctx.errors maps repo names to error messages for packages where GitHub
  // context load failed (e.g. due to rate-limiting). Downstream consumers
  // can inspect this to understand which results may be incomplete.
  const ctx = {
    tags: new Map(),
    releases: new Map(),
    errors: new Map(),
  };

  // Find the GitHub provider (context loader) — must run before ecosystem providers
  const ghProvider = activeProviders.find(p => p.name === "github");

  // Build results object with an array per ecosystem key present in the manifest
  const results = {};
  for (const key of Object.keys(manifest)) {
    if (Array.isArray(manifest[key])) results[key] = [];
  }
  results.generated = new Date().toISOString();

  const allFindings = [];

  // Process each ecosystem section from the manifest
  for (const [ecosystem, packages] of Object.entries(manifest)) {
    if (!Array.isArray(packages)) continue;
    process.stderr.write(`Auditing ${packages.length} ${ecosystem} packages...\n`);

    for (const pkg of packages) {
      const entry = { ...pkg, ecosystem };

      // Ensure GitHub context (tags + releases) is loaded for this repo.
      // Failures (e.g. rate-limit mid-loop) are recorded in ctx.errors so the
      // post-loop summary can warn operators that some results may be stale.
      if (ghProvider && ghProvider.detect(entry)) {
        try {
          await ghProvider.audit(entry, ctx);
        } catch (err) {
          process.stderr.write(`  provider "github" failed for ${pkg.name}: ${err.message}\n`);
          ctx.errors.set(pkg.name, err.message);
        }
      }

      // Find the ecosystem-specific provider(s)
      const ecosystemProviders = matchProviders(activeProviders, entry).filter(p => p.name !== "github");

      let version = "?";
      const findings = [];

      for (const provider of ecosystemProviders) {
        try {
          const result = await provider.audit(entry, ctx);
          if (result?.version != null && result.version !== "?") version = result.version;
          if (Array.isArray(result?.findings)) findings.push(...result.findings);
        } catch (err) {
          process.stderr.write(`  provider "${provider.name}" failed for ${pkg.name}: ${err.message}\n`);
          findings.push({
            severity: "RED",
            code: "provider-error",
            message: `Provider "${provider.name}" threw an unexpected error: ${err.message}`,
          });
        }
      }

      // GitHub metadata audit — check homepage for 'front-door' repos.
      // Runs after GitHub context (tags/releases) has already been loaded above.
      if (pkg.repo && entry.audience === "front-door") {
        try {
          const homepage = execFileSync(
            "gh", ["api", `repos/${pkg.repo}`, "--jq", ".homepage"],
            { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
          ).trim();
          // gh outputs "null" (string) when the field is unset
          if (!homepage || homepage === "null" || homepage === '""') {
            findings.push({
              severity: "YELLOW",
              code: "missing-homepage",
              message: `GitHub repo ${pkg.repo} has no homepage set`,
              ecosystem: "github",
            });
          }
        } catch (err) {
          process.stderr.write(`  github-metadata: failed to check homepage for ${pkg.repo}: ${err.message}\n`);
        }
      }

      const resultEntry = {
        name: pkg.name,
        version,
        repo: pkg.repo,
        audience: pkg.audience,
        findings,
      };

      if (results[ecosystem]) {
        results[ecosystem].push(resultEntry);
      }
      allFindings.push(...findings.map(f => ({ ...f, pkg: pkg.name, ecosystem })));
    }
  }

  // Warn if any GitHub context loads failed — those packages may have stale data.
  if (ctx.errors.size > 0) {
    const failed = [...ctx.errors.keys()].join(", ");
    process.stderr.write(
      `\nWARNING: GitHub context failed for ${ctx.errors.size} package(s): ${failed}\n` +
      `  Results for these packages may be incomplete or use stale tag/release data.\n` +
      `  Re-run after GitHub rate-limit resets to get accurate results.\n\n`
    );
  }

  // Counts
  const red = allFindings.filter(f => f.severity === "RED");
  const yellow = allFindings.filter(f => f.severity === "YELLOW");
  const gray = allFindings.filter(f => f.severity === "GRAY");
  const info = allFindings.filter(f => f.severity === "INFO");
  const counts = { RED: red.length, YELLOW: yellow.length, GRAY: gray.length, INFO: info.length };
  results.counts = counts;

  // Count total packages
  let totalPackages = 0;
  for (const [, val] of Object.entries(results)) {
    if (Array.isArray(val)) totalPackages += val.length;
  }
  results.totalPackages = totalPackages;

  return { results, allFindings, counts };
}
