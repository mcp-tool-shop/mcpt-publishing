/**
 * Shared audit loop — runs publishing health audit and returns structured results.
 *
 * Used by both `audit` (to generate reports) and `fix` (to discover fixable drift).
 * Does NOT write reports or emit receipts — callers handle that.
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

  // Shared context for tag/release caching
  const ctx = {
    tags: new Map(),
    releases: new Map(),
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

      // Ensure GitHub context (tags + releases) is loaded for this repo
      if (ghProvider && ghProvider.detect(entry)) {
        await ghProvider.audit(entry, ctx);
      }

      // Find the ecosystem-specific provider(s)
      const ecosystemProviders = matchProviders(activeProviders, entry).filter(p => p.name !== "github");

      let version = "?";
      const findings = [];

      for (const provider of ecosystemProviders) {
        const result = await provider.audit(entry, ctx);
        if (result.version && result.version !== "?") version = result.version;
        findings.push(...result.findings);
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
