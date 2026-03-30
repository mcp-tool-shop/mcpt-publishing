#!/usr/bin/env node
/**
 * Publishing health audit — queries registry providers to detect drift.
 *
 * Usage:
 *   node scripts/audit.mjs          # writes reports/latest.md + reports/latest.json
 *   node scripts/audit.mjs --json   # prints JSON to stdout only
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProviders, matchProviders } from "./lib/registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "profiles", "manifest.json"), "utf8"));
const JSON_ONLY = process.argv.includes("--json");
const SKIP_GRAY = process.argv.includes("--skip-gray");

// ─── Ecosystem labels for markdown headings ──────────────────────────────────

const ECOSYSTEM_LABELS = {
  npm: "npm",
  nuget: "NuGet",
  pypi: "PyPI",
  ghcr: "GHCR",
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const providers = await loadProviders();

  // Shared context for tag/release caching (replaces old tagCache/releaseCache)
  const ctx = {
    tags: new Map(),
    releases: new Map(),
  };

  // Find the GitHub provider (context loader) — must run before ecosystem providers
  const ghProvider = providers.find(p => p.name === "github");

  // Build results object with an array per ecosystem key present in the manifest
  const results = {};
  for (const key of Object.keys(MANIFEST)) {
    if (Array.isArray(MANIFEST[key])) results[key] = [];
  }
  results.generated = new Date().toISOString();
  results.unmatched = [];

  const allFindings = [];

  // Process each ecosystem section from the manifest
  for (const [ecosystem, packages] of Object.entries(MANIFEST)) {
    if (!Array.isArray(packages)) continue;
    process.stderr.write(`Auditing ${packages.length} ${ECOSYSTEM_LABELS[ecosystem] ?? ecosystem} packages...\n`);

    for (const pkg of packages) {
      const entry = { ...pkg, ecosystem };

      // Ensure GitHub context (tags + releases) is loaded for this repo
      if (ghProvider && ghProvider.detect(entry)) {
        await ghProvider.audit(entry, ctx);
      }

      // Find the ecosystem-specific provider(s)
      const ecosystemProviders = matchProviders(providers, entry).filter(p => p.name !== "github");

      if (ecosystemProviders.length === 0) {
        process.stderr.write(`Warning: no provider for ecosystem "${ecosystem}"\n`);
        results.unmatched.push({ ecosystem, name: pkg.name });
      }

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

  // ─── Fix hints ─────────────────────────────────────────────────────────────
  // Map common finding codes to actionable fix instructions.
  const FIX_HINTS = {
    "published-not-tagged": (f) => `git tag v${f.version ?? "<version>"} && git push origin v${f.version ?? "<version>"}`,
    "wrong-repo-url": () => "Update the repository field in package.json / .csproj to match the canonical GitHub URL",
    "missing-homepage": () => "Add a homepage field in package.json pointing to the project landing page or docs",
    "missing-readme": () => "Add a README.md to the repository root and re-publish",
    "missing-description": () => "Add a description field in package.json or .nuspec",
    "bad-description": () => "Replace the description field in package.json with plain text (no HTML)",
    "missing-bugs-url": () => "Add a bugs.url field in package.json pointing to the GitHub issues page",
    "missing-keywords": () => "Add a keywords array in package.json",
    "missing-project-url": () => "Add <PackageProjectUrl> to the .csproj file",
    "missing-icon": () => "Add <PackageIcon> and include a logo PNG in the .csproj file",
    "tagged-not-released": (f) => `gh release create ${f.tag ?? "<tag>"} --generate-notes`,
    "npm-unreachable": () => "Check that the package is published and the name is correct in manifest.json",
    "nuget-unreachable": () => "Check that the package is published and the ID is correct in manifest.json",
  };

  for (const f of allFindings) {
    const hintFn = FIX_HINTS[f.code];
    if (hintFn) f.fixHint = hintFn(f);
  }

  // ─── Skip-gray filter ───────────────────────────────────────────────────────
  // When --skip-gray is set, remove GRAY findings from allFindings and per-package
  // finding arrays so they are omitted from both JSON output and the markdown report.
  if (SKIP_GRAY) {
    const isNotGray = f => f.severity !== "GRAY";
    for (const [ecosystem, packages] of Object.entries(results)) {
      if (!Array.isArray(packages)) continue;
      for (const e of packages) {
        e.findings = e.findings.filter(isNotGray);
      }
    }
    // Filter the flat allFindings array in-place
    allFindings.splice(0, allFindings.length, ...allFindings.filter(isNotGray));
  }

  // Counts
  const red = allFindings.filter(f => f.severity === "RED");
  const yellow = allFindings.filter(f => f.severity === "YELLOW");
  const gray = allFindings.filter(f => f.severity === "GRAY");
  const info = allFindings.filter(f => f.severity === "INFO");
  results.counts = { RED: red.length, YELLOW: yellow.length, GRAY: gray.length, INFO: info.length };

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    return;
  }

  // Generate markdown report
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
        const hint = f.fixHint ? ` — _Fix: ${f.fixHint}_` : "";
        lines.push(`- **${f.severity}** [${f.code}] ${f.msg}${hint}`);
      }
      lines.push("");
    }
  }

  // Summary tables per ecosystem
  for (const [ecosystem, packages] of Object.entries(MANIFEST)) {
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

  const md = lines.join("\n");

  // Write reports
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(join(ROOT, "reports", "latest.md"), md);
  writeFileSync(join(ROOT, "reports", "latest.json"), JSON.stringify(results, null, 2));

  const infoSuffix = info.length > 0 ? ` INFO=${info.length} (indexing — retry later)` : "";
  process.stderr.write(`\nDone. RED=${red.length} YELLOW=${yellow.length} GRAY=${gray.length}${infoSuffix}\n`);
  process.stderr.write(`Reports written to reports/latest.md and reports/latest.json\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
