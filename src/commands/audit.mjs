/**
 * `mcpt-publishing audit` — run publishing health audit across all registries.
 *
 * Loads config → reads manifest → delegates to runAudit() → writes reports → emits receipt.
 *
 * Exit codes:
 *   0 — all clean
 *   2 — RED-severity drift found
 *   3 — config or file error
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../config/loader.mjs";
import { runAudit } from "../audit/run-audit.mjs";
import { emitAuditReceipt } from "../receipts/audit-receipt.mjs";
import { EXIT } from "../cli/exit-codes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ecosystem labels for markdown headings
const ECOSYSTEM_LABELS = {
  npm: "npm",
  nuget: "NuGet",
  pypi: "PyPI",
  ghcr: "GHCR",
  smithery: "Smithery",
  flyio: "Fly.io",
  github: "GitHub",
};

export const helpText = `
mcpt-publishing audit — Run publishing health audit.

Usage:
  mcpt-publishing audit [flags]

Flags:
  --json                Output JSON to stdout (skip markdown reports)
  --repo <owner/name>   Filter to packages from this repo
  --target <ecosystem>  Filter to one ecosystem (npm, nuget, pypi, ghcr)
  --severity <level>    Filter findings output by severity (RED, YELLOW, GRAY, INFO)
  --quiet               Suppress per-package progress output
  --config              Explicit path to publishing.config.json
  --help                Show this help

Exit codes:
  0   All packages clean
  2   RED-severity drift detected (CI-friendly non-zero)

Examples:
  mcpt-publishing audit              # writes reports/latest.md + .json
  mcpt-publishing audit --json       # JSON to stdout only
  mcpt-publishing audit --repo mcp-tool-shop-org/mcpt
  mcpt-publishing audit --target npm
  mcpt-publishing audit --severity RED
`.trim();

/**
 * Execute the audit command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  // Load config
  if (flags.config) {
    process.env.PUBLISHING_CONFIG = resolve(flags.config);
  }
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    process.stderr.write(`Error loading config: ${e.message}\nCheck publishing.config.json or set PUBLISHING_CONFIG.\n`);
    return EXIT.CONFIG_ERROR;
  }

  // Read manifest
  const manifestPath = join(config.profilesDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`Error: Manifest not found at ${manifestPath}\n`);
    process.stderr.write(`Run 'mcpt-publishing init' to scaffold the project.\n`);
    return EXIT.CONFIG_ERROR;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    process.stderr.write(`Error: manifest.json is invalid JSON: ${e.message}\n`);
    return EXIT.CONFIG_ERROR;
  }

  // Apply --repo and --target filters to the manifest before auditing
  if (flags.repo || flags.target) {
    for (const [ecosystem, packages] of Object.entries(manifest)) {
      if (!Array.isArray(packages)) continue;
      // If --target is set, remove entire ecosystems that don't match
      if (flags.target && ecosystem !== flags.target) {
        manifest[ecosystem] = [];
        continue;
      }
      // If --repo is set, keep only entries matching that repo
      if (flags.repo) {
        manifest[ecosystem] = packages.filter(entry => entry.repo === flags.repo);
      }
    }
  }

  // Warn about typo'd enabledProviders (FT-CLI-016)
  {
    const registryPath = join(__dirname, "..", "..", "scripts", "lib", "registry.mjs");
    if (existsSync(registryPath)) {
      try {
        const { loadProviders } = await import(pathToFileURL(registryPath).href);
        const providers = await loadProviders();
        const providerNames = providers.map(p => p.name);
        const enabled = config.enabledProviders ?? [];
        for (const name of enabled) {
          if (!providerNames.includes(name)) {
            process.stderr.write(`Warning: enabledProviders contains unknown provider "${name}". Known providers: ${providerNames.join(", ")}\n`);
          }
        }
      } catch {
        // Silently ignore — the main audit loop handles registry errors
      }
    }
  }

  // Run the shared audit loop
  const { results, allFindings, counts } = await runAudit(config, manifest);

  // Apply --severity filter to findings (for output only — exit code uses full set)
  const severityFilter = flags.severity ? flags.severity.toUpperCase() : null;
  const filteredFindings = severityFilter
    ? allFindings.filter(f => f.severity === severityFilter)
    : allFindings;

  const red = allFindings.filter(f => f.severity === "RED");
  const yellow = allFindings.filter(f => f.severity === "YELLOW");
  const gray = allFindings.filter(f => f.severity === "GRAY");
  const info = allFindings.filter(f => f.severity === "INFO");

  // JSON-only mode
  if (flags.json) {
    // When severity filter is active, include only matching findings per package
    let outputResults = results;
    if (severityFilter) {
      outputResults = { ...results };
      for (const key of Object.keys(outputResults)) {
        if (Array.isArray(outputResults[key])) {
          outputResults[key] = outputResults[key].map(entry => ({
            ...entry,
            findings: entry.findings.filter(f => f.severity === severityFilter),
          }));
        }
      }
    }
    process.stdout.write(JSON.stringify(outputResults, null, 2) + "\n");
    emitAuditReceipt(config, results);
    return red.length > 0 ? EXIT.DRIFT_FOUND : EXIT.SUCCESS;
  }

  // Generate markdown report (always uses full unfiltered findings for the report files)
  const md = buildMarkdownReport(results, manifest, allFindings, red, yellow, gray, info);

  // Write reports
  mkdirSync(config.reportsDir, { recursive: true });
  writeFileSync(join(config.reportsDir, "latest.md"), md);
  writeFileSync(join(config.reportsDir, "latest.json"), JSON.stringify(results, null, 2));

  const infoSuffix = info.length > 0 ? ` INFO=${info.length} (indexing — retry later)` : "";
  if (!flags.quiet) {
    process.stderr.write(`\nDone. RED=${red.length} YELLOW=${yellow.length} GRAY=${gray.length}${infoSuffix}\n`);
    process.stderr.write(`Reports written to ${config.reportsDir}/latest.md and latest.json\n`);
  }

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
