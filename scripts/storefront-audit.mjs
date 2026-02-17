#!/usr/bin/env node
/**
 * Storefront professionalism audit — checks every published repo for
 * logos, README quality, GitHub About fields, license, and back-to-site links.
 *
 * Usage:
 *   node scripts/storefront-audit.mjs          # writes reports/storefront.md + storefront.json
 *   node scripts/storefront-audit.mjs --json   # prints JSON to stdout only
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "profiles", "manifest.json"), "utf8"));
const JSON_ONLY = process.argv.includes("--json");

const SITE_URL = "https://mcptoolshop.com";
const LOGO_PATHS = ["logo.png", "logo.svg", "assets/logo.png", "assets/logo.svg", "assets/icon.png", "assets/logo-dark.jpg", "assets/logo-dark.png"];

// ─── Helpers ──────────────────────────────────────────────────────────────

function gh(endpoint) {
  try {
    return JSON.parse(execSync(`gh api "${endpoint}"`, { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }));
  } catch { return null; }
}

function ghText(endpoint) {
  try {
    return execSync(`gh api "${endpoint}" -H "Accept: application/vnd.github.raw+json"`, { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] });
  } catch { return null; }
}

function fileExists(repo, path) {
  try {
    execSync(`gh api "repos/${repo}/contents/${path}" --jq .name`, { encoding: "utf8", timeout: 10_000, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch { return false; }
}

// ─── Per-repo checks ─────────────────────────────────────────────────────

function auditRepo(repo, audience, packages) {
  const findings = [];
  const isFrontDoor = audience === "front-door";

  // 1. Repo metadata
  const meta = gh(`repos/${repo}`);
  if (!meta) {
    findings.push({ severity: "RED", code: "repo-unreachable", msg: `Cannot reach ${repo}` });
    return { repo, audience, packages, findings, meta: null };
  }

  const desc = meta.description || "";
  const homepage = meta.homepage || "";
  const topics = meta.topics || [];
  const hasLicense = meta.license != null;

  // 2. Logo
  let logoFile = null;
  for (const p of LOGO_PATHS) {
    if (fileExists(repo, p)) { logoFile = p; break; }
  }
  if (!logoFile) {
    findings.push({
      severity: isFrontDoor ? "RED" : "YELLOW",
      code: "missing-logo",
      msg: `${repo} has no logo file`
    });
  }

  // 3. README
  const readme = ghText(`repos/${repo}/contents/README.md`);
  if (!readme) {
    findings.push({ severity: "RED", code: "missing-readme", msg: `${repo} has no README.md` });
  } else {
    const lower = readme.toLowerCase();

    // Logo at top of README
    if (!readme.match(/^#?\s*[<!\[]*img|^#?\s*!\[/m) && !readme.match(/<img\s/i)) {
      // Check for image in first 10 lines
      const firstLines = readme.split("\n").slice(0, 10).join("\n");
      if (!firstLines.includes("![") && !firstLines.includes("<img")) {
        findings.push({
          severity: isFrontDoor ? "RED" : "YELLOW",
          code: "readme-no-logo",
          msg: `${repo} README has no logo at top`
        });
      }
    }

    // Install command
    if (!lower.includes("install") && !lower.includes("npm i") && !lower.includes("pip install") && !lower.includes("dotnet add") && !lower.includes("npx") && !lower.includes("nuget")) {
      if (isFrontDoor) {
        findings.push({ severity: "RED", code: "readme-no-install", msg: `${repo} README has no install instructions` });
      }
    }

    // Quickstart / usage
    if (!lower.includes("quick") && !lower.includes("usage") && !lower.includes("getting started") && !lower.includes("example")) {
      if (isFrontDoor) {
        findings.push({ severity: "YELLOW", code: "readme-no-quickstart", msg: `${repo} README has no quickstart/usage section` });
      }
    }

    // Back-to-site link
    if (!readme.includes(SITE_URL) && !readme.includes("mcptoolshop.com") && !readme.includes("MCP Tool Shop")) {
      findings.push({
        severity: isFrontDoor ? "YELLOW" : "GRAY",
        code: "readme-no-site-link",
        msg: `${repo} README has no link back to MCP Tool Shop`
      });
    }
  }

  // 4. License
  if (!hasLicense) {
    findings.push({ severity: "RED", code: "missing-license", msg: `${repo} has no LICENSE file` });
  }

  // 5. GitHub About — description
  if (!desc) {
    findings.push({ severity: "RED", code: "missing-description", msg: `${repo} has no GitHub description` });
  }

  // 6. GitHub About — homepage
  if (!homepage) {
    findings.push({
      severity: isFrontDoor ? "YELLOW" : "GRAY",
      code: "missing-homepage",
      msg: `${repo} has no homepage URL in About`
    });
  } else if (!homepage.includes("mcptoolshop.com")) {
    findings.push({
      severity: "GRAY",
      code: "homepage-not-site",
      msg: `${repo} homepage "${homepage}" doesn't point to mcptoolshop.com`
    });
  }

  // 7. Topics
  if (topics.length === 0) {
    findings.push({
      severity: isFrontDoor ? "YELLOW" : "GRAY",
      code: "no-topics",
      msg: `${repo} has no topics/tags`
    });
  }

  return {
    repo,
    audience,
    packages,
    findings,
    meta: { description: desc, homepage, topics, hasLicense, logoFile, hasReadme: !!readme }
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Deduplicate repos and determine audience (front-door wins over internal)
  const repoMap = {};
  for (const pkg of [...MANIFEST.npm, ...MANIFEST.nuget]) {
    if (pkg.deprecated) continue;
    if (!repoMap[pkg.repo]) {
      repoMap[pkg.repo] = { audience: pkg.audience, packages: [] };
    }
    repoMap[pkg.repo].packages.push(pkg.name);
    if (pkg.audience === "front-door") repoMap[pkg.repo].audience = "front-door";
  }

  const repos = Object.entries(repoMap).sort(([, a], [, b]) => {
    if (a.audience === "front-door" && b.audience !== "front-door") return -1;
    if (a.audience !== "front-door" && b.audience === "front-door") return 1;
    return 0;
  });

  process.stderr.write(`Auditing ${repos.length} repos for storefront readiness...\n`);

  const results = [];
  const allFindings = [];

  for (const [repo, { audience, packages }] of repos) {
    process.stderr.write(`  ${repo}...\n`);
    const result = auditRepo(repo, audience, packages);
    results.push(result);
    allFindings.push(...result.findings.map(f => ({ ...f, repo })));
  }

  // Counts
  const red = allFindings.filter(f => f.severity === "RED");
  const yellow = allFindings.filter(f => f.severity === "YELLOW");
  const gray = allFindings.filter(f => f.severity === "GRAY");
  const counts = { RED: red.length, YELLOW: yellow.length, GRAY: gray.length };

  const output = { generated: new Date().toISOString(), counts, repos: results };

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return;
  }

  // Generate markdown
  const lines = [];
  lines.push("# Storefront Readiness Report");
  lines.push("");
  lines.push(`> Generated: ${output.generated}`);
  lines.push("");
  lines.push(`**RED: ${red.length}** | **YELLOW: ${yellow.length}** | **GRAY: ${gray.length}**`);
  lines.push("");

  if (red.length + yellow.length > 0) {
    lines.push("## Top Actions");
    lines.push("");
    for (const f of [...red, ...yellow].slice(0, 20)) {
      lines.push(`- **${f.severity}** ${f.msg}`);
    }
    lines.push("");
  }

  // Summary table
  lines.push("## Repo Summary");
  lines.push("");
  lines.push("| Repo | Audience | Logo | README | License | Homepage | Topics | Issues |");
  lines.push("|------|----------|------|--------|---------|----------|--------|--------|");
  for (const r of results) {
    const m = r.meta;
    if (!m) {
      lines.push(`| ${r.repo} | ${r.audience} | ? | ? | ? | ? | ? | ERROR |`);
      continue;
    }
    const issueCount = r.findings.filter(f => f.severity !== "GRAY").length;
    const status = issueCount === 0 ? "clean" : r.findings.filter(f => f.severity !== "GRAY").map(f => f.severity).join(",");
    lines.push(`| ${r.repo} | ${r.audience} | ${m.logoFile || "NONE"} | ${m.hasReadme ? "yes" : "NO"} | ${m.hasLicense ? "yes" : "NO"} | ${m.homepage ? "yes" : "NO"} | ${m.topics.length} | ${status} |`);
  }
  lines.push("");

  // Detailed findings
  const byRepo = {};
  for (const f of allFindings) {
    if (!byRepo[f.repo]) byRepo[f.repo] = [];
    byRepo[f.repo].push(f);
  }

  if (Object.keys(byRepo).length > 0) {
    lines.push("## Findings by Repo");
    lines.push("");
    for (const [repo, findings] of Object.entries(byRepo)) {
      lines.push(`### ${repo}`);
      for (const f of findings) {
        lines.push(`- **${f.severity}** [${f.code}] ${f.msg}`);
      }
      lines.push("");
    }
  }

  const md = lines.join("\n");

  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(join(ROOT, "reports", "storefront.md"), md);
  writeFileSync(join(ROOT, "reports", "storefront.json"), JSON.stringify(output, null, 2));

  process.stderr.write(`\nDone. RED=${red.length} YELLOW=${yellow.length} GRAY=${gray.length}\n`);
  process.stderr.write(`Reports written to reports/storefront.md and reports/storefront.json\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
