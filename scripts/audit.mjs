#!/usr/bin/env node
/**
 * Publishing health audit — queries npm, NuGet, and GitHub to detect drift.
 *
 * Usage:
 *   node scripts/audit.mjs          # writes reports/latest.md + reports/latest.json
 *   node scripts/audit.mjs --json   # prints JSON to stdout only
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "profiles", "manifest.json"), "utf8"));
const JSON_ONLY = process.argv.includes("--json");

// ─── Providers ──────────────────────────────────────────────────────────────

async function fetchNpmMeta(pkg) {
  try {
    const raw = execSync(`npm view ${pkg} --json 2>&1`, { encoding: "utf8", timeout: 15_000 });
    return JSON.parse(raw);
  } catch { return null; }
}

async function fetchNuGetMeta(id) {
  try {
    const url = `https://azuresearch-usnc.nuget.org/query?q=packageid:${id}&take=1`;
    const raw = execSync(`curl -sf "${url}"`, { encoding: "utf8", timeout: 15_000 });
    const data = JSON.parse(raw);
    return data.data?.[0] ?? null;
  } catch { return null; }
}

function getGitTags(repo) {
  try {
    const raw = execSync(`gh api repos/${repo}/tags --jq ".[].name" 2>&1`, { encoding: "utf8", timeout: 15_000 });
    return raw.trim().split("\n").filter(Boolean);
  } catch { return []; }
}

function getGitReleases(repo) {
  try {
    const raw = execSync(`gh api repos/${repo}/releases --jq ".[].tag_name" 2>&1`, { encoding: "utf8", timeout: 15_000 });
    return raw.trim().split("\n").filter(Boolean);
  } catch { return []; }
}

// ─── Severity logic ─────────────────────────────────────────────────────────

function classifyNpm(pkg, meta, tags, releases) {
  const findings = [];
  if (!meta) {
    findings.push({ severity: "RED", code: "npm-unreachable", msg: `Cannot reach ${pkg.name} on npm` });
    return findings;
  }

  const ver = meta["dist-tags"]?.latest ?? meta.version;
  const tagName = `v${ver}`;

  // Published-but-not-tagged
  if (!tags.includes(tagName)) {
    findings.push({ severity: "RED", code: "published-not-tagged", msg: `${pkg.name}@${ver} — no git tag ${tagName}` });
  }

  // Tagged-but-not-released
  if (tags.includes(tagName) && !releases.includes(tagName) && pkg.audience === "front-door") {
    findings.push({ severity: "YELLOW", code: "tagged-not-released", msg: `${pkg.name} tag ${tagName} has no GitHub Release` });
  }

  // Repo URL check
  const repoUrl = meta.repository?.url ?? "";
  if (!repoUrl.includes(pkg.repo.split("/")[0])) {
    findings.push({ severity: "RED", code: "wrong-repo-url", msg: `${pkg.name} repo URL "${repoUrl}" doesn't match expected ${pkg.repo}` });
  }

  // Description
  const desc = meta.description ?? "";
  if (!desc || desc.startsWith("<") || desc.includes("<img")) {
    findings.push({ severity: "RED", code: "bad-description", msg: `${pkg.name} has missing/HTML description` });
  }

  // README
  if (meta.readme === "ERROR: No README data found!" || meta.readme === "") {
    if (pkg.audience === "front-door") {
      findings.push({ severity: "YELLOW", code: "missing-readme", msg: `${pkg.name} has no README on npm` });
    } else {
      findings.push({ severity: "GRAY", code: "missing-readme", msg: `${pkg.name} (internal) has no README on npm` });
    }
  }

  // Homepage
  if (!meta.homepage) {
    findings.push({ severity: "GRAY", code: "missing-homepage", msg: `${pkg.name} has no homepage` });
  }

  return findings;
}

function classifyNuGet(pkg, meta, tags, releases) {
  const findings = [];
  if (!meta) {
    findings.push({ severity: "RED", code: "nuget-unreachable", msg: `Cannot reach ${pkg.name} on NuGet` });
    return findings;
  }

  const ver = meta.version;
  const tagName = `v${ver}`;

  // Published-but-not-tagged
  if (!tags.includes(tagName)) {
    findings.push({ severity: "RED", code: "published-not-tagged", msg: `${pkg.name}@${ver} — no git tag ${tagName}` });
  }

  // ProjectUrl
  if (!meta.projectUrl) {
    if (pkg.audience === "front-door") {
      findings.push({ severity: "YELLOW", code: "missing-project-url", msg: `${pkg.name} has no projectUrl on NuGet` });
    }
  }

  // Icon
  if (!meta.iconUrl && pkg.audience === "front-door") {
    findings.push({ severity: "YELLOW", code: "missing-icon", msg: `${pkg.name} (front-door) has no icon` });
  }

  // Description
  if (!meta.description) {
    findings.push({ severity: "GRAY", code: "missing-description", msg: `${pkg.name} has no description` });
  }

  return findings;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const results = { npm: [], nuget: [], generated: new Date().toISOString() };
  const allFindings = [];

  // Cache tags/releases per repo (avoid duplicate API calls for monorepos)
  const tagCache = {};
  const releaseCache = {};
  function getTags(repo) {
    if (!tagCache[repo]) tagCache[repo] = getGitTags(repo);
    return tagCache[repo];
  }
  function getReleases(repo) {
    if (!releaseCache[repo]) releaseCache[repo] = getGitReleases(repo);
    return releaseCache[repo];
  }

  // npm packages
  process.stderr.write(`Auditing ${MANIFEST.npm.length} npm packages...\n`);
  for (const pkg of MANIFEST.npm) {
    const meta = await fetchNpmMeta(pkg.name);
    const tags = getTags(pkg.repo);
    const releases = getReleases(pkg.repo);
    const ver = meta?.["dist-tags"]?.latest ?? meta?.version ?? "?";
    const findings = classifyNpm(pkg, meta, tags, releases);
    const entry = { name: pkg.name, version: ver, repo: pkg.repo, audience: pkg.audience, findings };
    results.npm.push(entry);
    allFindings.push(...findings.map(f => ({ ...f, pkg: pkg.name, ecosystem: "npm" })));
  }

  // NuGet packages
  process.stderr.write(`Auditing ${MANIFEST.nuget.length} NuGet packages...\n`);
  for (const pkg of MANIFEST.nuget) {
    const meta = await fetchNuGetMeta(pkg.name);
    const tags = getTags(pkg.repo);
    const releases = getReleases(pkg.repo);
    const ver = meta?.version ?? "?";
    const findings = classifyNuGet(pkg, meta, tags, releases);
    const entry = { name: pkg.name, version: ver, repo: pkg.repo, audience: pkg.audience, findings };
    results.nuget.push(entry);
    allFindings.push(...findings.map(f => ({ ...f, pkg: pkg.name, ecosystem: "nuget" })));
  }

  // Counts
  const red = allFindings.filter(f => f.severity === "RED");
  const yellow = allFindings.filter(f => f.severity === "YELLOW");
  const gray = allFindings.filter(f => f.severity === "GRAY");
  results.counts = { RED: red.length, YELLOW: yellow.length, GRAY: gray.length };

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
  lines.push(`**RED: ${red.length}** | **YELLOW: ${yellow.length}** | **GRAY: ${gray.length}**`);
  lines.push("");

  if (red.length + yellow.length > 0) {
    lines.push("## Top Actions");
    lines.push("");
    for (const f of [...red, ...yellow].slice(0, 10)) {
      lines.push(`- **${f.severity}** ${f.msg}`);
    }
    lines.push("");
  }

  // Group by repo
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

  // npm summary table
  lines.push("## npm Packages");
  lines.push("");
  lines.push("| Package | Version | Audience | Issues |");
  lines.push("|---------|---------|----------|--------|");
  for (const e of results.npm) {
    const issues = e.findings.length === 0 ? "clean" : e.findings.map(f => f.severity).join(", ");
    lines.push(`| ${e.name} | ${e.version} | ${e.audience} | ${issues} |`);
  }
  lines.push("");

  // NuGet summary table
  lines.push("## NuGet Packages");
  lines.push("");
  lines.push("| Package | Version | Audience | Issues |");
  lines.push("|---------|---------|----------|--------|");
  for (const e of results.nuget) {
    const issues = e.findings.length === 0 ? "clean" : e.findings.map(f => f.severity).join(", ");
    lines.push(`| ${e.name} | ${e.version} | ${e.audience} | ${issues} |`);
  }
  lines.push("");

  const md = lines.join("\n");

  // Write reports
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(join(ROOT, "reports", "latest.md"), md);
  writeFileSync(join(ROOT, "reports", "latest.json"), JSON.stringify(results, null, 2));

  process.stderr.write(`\nDone. RED=${red.length} YELLOW=${yellow.length} GRAY=${gray.length}\n`);
  process.stderr.write(`Reports written to reports/latest.md and reports/latest.json\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
