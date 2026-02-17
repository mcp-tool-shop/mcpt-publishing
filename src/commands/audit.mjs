/**
 * `mcpt-publishing audit` — run publishing health audit across all registries.
 *
 * Loads config → reads manifest → imports providers from scripts/lib/registry.mjs
 * → runs orchestration loop → writes reports → emits audit receipt.
 *
 * Exit codes:
 *   0 — all clean
 *   2 — RED-severity drift found
 *   3 — config or file error
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../config/loader.mjs";
import { emitAuditReceipt } from "../receipts/audit-receipt.mjs";
import { EXIT } from "../cli/exit-codes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ecosystem labels for markdown headings
const ECOSYSTEM_LABELS = {
  npm: "npm",
  nuget: "NuGet",
  pypi: "PyPI",
  ghcr: "GHCR",
};

export const helpText = `
mcpt-publishing audit — Run publishing health audit.

Usage:
  mcpt-publishing audit [flags]

Flags:
  --json        Output JSON to stdout (skip markdown reports)
  --config      Explicit path to publishing.config.json
  --help        Show this help

Exit codes:
  0   All packages clean
  2   RED-severity drift detected (CI-friendly non-zero)

Examples:
  mcpt-publishing audit              # writes reports/latest.md + .json
  mcpt-publishing audit --json       # JSON to stdout only
`.trim();

/**
 * Execute the audit command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  // Load config
  const config = flags.config
    ? loadConfig(dirname(flags.config))
    : loadConfig();

  // Read manifest
  const manifestPath = join(config.profilesDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`Error: Manifest not found at ${manifestPath}\n`);
    process.stderr.write(`Run 'mcpt-publishing init' to scaffold the project.\n`);
    return EXIT.CONFIG_ERROR;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // Import provider registry from scripts/lib (reuse existing working code)
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
    process.stderr.write(`Auditing ${packages.length} ${ECOSYSTEM_LABELS[ecosystem] ?? ecosystem} packages...\n`);

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
  results.counts = { RED: red.length, YELLOW: yellow.length, GRAY: gray.length, INFO: info.length };

  // Count total packages
  let totalPackages = 0;
  for (const [, val] of Object.entries(results)) {
    if (Array.isArray(val)) totalPackages += val.length;
  }
  results.totalPackages = totalPackages;

  // JSON-only mode
  if (flags.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    emitAuditReceipt(config, results);
    return red.length > 0 ? EXIT.DRIFT_FOUND : EXIT.SUCCESS;
  }

  // Generate markdown report
  const md = buildMarkdownReport(results, manifest, allFindings, red, yellow, gray, info);

  // Write reports
  mkdirSync(config.reportsDir, { recursive: true });
  writeFileSync(join(config.reportsDir, "latest.md"), md);
  writeFileSync(join(config.reportsDir, "latest.json"), JSON.stringify(results, null, 2));

  const infoSuffix = info.length > 0 ? ` INFO=${info.length} (indexing — retry later)` : "";
  process.stderr.write(`\nDone. RED=${red.length} YELLOW=${yellow.length} GRAY=${gray.length}${infoSuffix}\n`);
  process.stderr.write(`Reports written to ${config.reportsDir}/latest.md and latest.json\n`);

  // Emit audit receipt
  emitAuditReceipt(config, results);

  return red.length > 0 ? EXIT.DRIFT_FOUND : EXIT.SUCCESS;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildMarkdownReport(results, manifest, allFindings, red, yellow, gray, info) {
  const lines = [];
  lines.push("# Publishing Health Report");
  lines.push("");
  lines.push(`> Generated: ${results.generated}`);
  lines.push("");
  const infoLabel = info.length > 0 ? ` | **INFO: ${info.length}** (indexing)` : "";
  lines.push(`**RED: ${red.length}** | **YELLOW: ${yellow.length}** | **GRAY: ${gray.length}**${infoLabel}`);
  lines.push("");

  if (red.length + yellow.length + info.length > 0) {
    lines.push("## Top Actions");
    lines.push("");
    for (const f of [...red, ...yellow, ...info].slice(0, 10)) {
      lines.push(`- **${f.severity}** ${f.msg}`);
    }
    lines.push("");
  }

  // Group by package
  const byRepo = {};
  for (const f of allFindings) {
    const key = f.pkg;
    if (!byRepo[key]) byRepo[key] = [];
    byRepo[key].push(f);
  }

  if (Object.keys(byRepo).length > 0) {
    lines.push("## Findings by Package");
    lines.push("");
    for (const [pkg, findings] of Object.entries(byRepo)) {
      lines.push(`### ${pkg}`);
      for (const f of findings) {
        lines.push(`- **${f.severity}** [${f.code}] ${f.msg}`);
      }
      lines.push("");
    }
  }

  // Summary tables per ecosystem
  for (const [ecosystem, packages] of Object.entries(manifest)) {
    if (!Array.isArray(packages) || packages.length === 0) continue;
    const label = ECOSYSTEM_LABELS[ecosystem] ?? ecosystem;

    lines.push(`## ${label} Packages`);
    lines.push("");
    lines.push("| Package | Version | Audience | Issues |");
    lines.push("|---------|---------|----------|--------|");
    for (const e of results[ecosystem] ?? []) {
      const issues = e.findings.length === 0 ? "clean" : e.findings.map(f => f.severity).join(", ");
      lines.push(`| ${e.name} | ${e.version} | ${e.audience} | ${issues} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
