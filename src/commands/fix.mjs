/**
 * `mcpt-publishing fix` — apply allowlisted metadata fixes.
 *
 * Runs audit internally, matches findings to fixers, applies fixes either
 * locally (default), remotely (--remote), or as a PR (--pr).
 *
 * Exit codes:
 *   0 — success (or nothing to fix)
 *   3 — config or file error
 *   6 — one or more fixes failed to apply
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { loadConfig } from "../config/loader.mjs";
import { runAudit } from "../audit/run-audit.mjs";
import { emitFixReceipt } from "../receipts/fix-receipt.mjs";
import { EXIT } from "../cli/exit-codes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const helpText = `
mcpt-publishing fix — Apply allowlisted metadata fixes.

Usage:
  mcpt-publishing fix [flags]

Flags:
  --repo <owner/name>   Fix only packages from this repo
  --target <ecosystem>  Fix only this ecosystem (npm, nuget, readme, github)
  --cwd <path>          Working directory for local fixes (default: cwd)
  --remote              Apply fixes via GitHub API (no local checkout needed)
  --pr                  Apply local fixes, then create a PR
  --dry-run             Preview fixes without applying
  --json                Output results as JSON
  --help                Show this help

Modes:
  Default (local)       Edit files on disk in --cwd
  --remote              Push changes via GitHub API (fleet-wide, no clones)
  --pr                  Local edits → branch → commit → push → open PR

Exit codes:
  0   All fixes applied (or nothing to fix)
  6   One or more fixes failed

Examples:
  mcpt-publishing fix --dry-run                              # preview all fixes
  mcpt-publishing fix --repo mcp-tool-shop-org/mcpt          # fix one repo
  mcpt-publishing fix --remote --dry-run                     # preview remote fixes
  mcpt-publishing fix --pr                                   # local fixes as PR
`.trim();

/**
 * Execute the fix command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  // 1. Load config
  const config = flags.config
    ? loadConfig(dirname(flags.config))
    : loadConfig();

  // 2. Read manifest
  const manifestPath = join(config.profilesDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`Error: Manifest not found at ${manifestPath}\n`);
    process.stderr.write(`Run 'mcpt-publishing init' to scaffold the project.\n`);
    return EXIT.CONFIG_ERROR;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // 3. Run audit to discover drift
  if (!flags.json) {
    process.stderr.write("Running audit to discover fixable drift...\n\n");
  }
  const { allFindings, counts: auditBefore } = await runAudit(config, manifest);

  // 4. Load fixers
  const fixerRegistryPath = join(__dirname, "..", "fixers", "registry.mjs");
  const { loadFixers, matchFixers } = await import(pathToFileURL(fixerRegistryPath).href);
  const fixers = await loadFixers();

  // 5. Match findings to fixers, build fix plan
  const dryRun = !!flags["dry-run"];
  const remote = !!flags.remote;
  const prMode = !!flags.pr;
  const cwd = flags.cwd ? resolve(flags.cwd) : process.cwd();
  const repoFilter = flags.repo || null;
  const targetFilter = flags.target || null;

  // Deduplicate: group findings by repo + fixer to avoid applying same fix twice
  const fixPlan = new Map(); // key: "repo|fixerCode" → { entry, fixer, findings }

  for (const finding of allFindings) {
    // Apply filters
    if (repoFilter) {
      // Find the entry repo for this finding
      const entryRepo = findRepoForFinding(manifest, finding);
      if (entryRepo !== repoFilter) continue;
    }
    if (targetFilter && finding.ecosystem !== targetFilter && targetFilter !== "readme" && targetFilter !== "github") continue;

    const matched = matchFixers(fixers, finding);
    for (const fixer of matched) {
      if (targetFilter && fixer.target !== targetFilter) continue;

      const entry = findEntryForFinding(manifest, finding);
      if (!entry) continue;

      const key = `${entry.repo}|${fixer.code}`;
      if (!fixPlan.has(key)) {
        fixPlan.set(key, { entry, fixer, findings: [] });
      }
      fixPlan.get(key).findings.push(finding);
    }
  }

  if (fixPlan.size === 0) {
    if (flags.json) {
      process.stdout.write(JSON.stringify({ changes: [], fixable: 0, message: "No fixable findings" }) + "\n");
    } else {
      process.stderr.write("No fixable findings detected.\n");
    }
    return EXIT.SUCCESS;
  }

  // 6. Apply fixes
  const mode = dryRun ? "dry-run" : remote ? "remote" : prMode ? "local" : "local";
  const changes = [];
  let failures = 0;

  if (!flags.json) {
    process.stderr.write(`Found ${fixPlan.size} fixable items (mode: ${mode}):\n\n`);
  }

  for (const [key, { entry, fixer, findings }] of fixPlan) {
    const label = `${entry.repo} → ${fixer.code}`;

    try {
      // Diagnose first
      const diagnosis = await fixer.diagnose(entry, {}, { cwd, remote });
      if (!diagnosis.needed) {
        if (!flags.json) {
          process.stderr.write(`  SKIP  ${label} (already fixed)\n`);
        }
        continue;
      }

      if (dryRun) {
        if (!flags.json) {
          process.stderr.write(`  [would fix]  ${label}\n`);
          if (diagnosis.before !== undefined) {
            process.stderr.write(`    before: ${JSON.stringify(diagnosis.before)}\n`);
            process.stderr.write(`    after:  ${JSON.stringify(diagnosis.after)}\n`);
          }
        }
        changes.push({
          fixerCode: fixer.code,
          target: fixer.target,
          packageName: entry.name,
          field: fixer.describe(),
          before: diagnosis.before ?? null,
          after: diagnosis.after ?? null,
          file: diagnosis.file ?? null,
        });
        continue;
      }

      // Apply
      const result = remote
        ? await fixer.applyRemote(entry, {}, { cwd })
        : await fixer.applyLocal(entry, {}, { cwd });

      if (result.changed) {
        if (!flags.json) {
          process.stderr.write(`  OK    ${label}\n`);
        }
        changes.push({
          fixerCode: fixer.code,
          target: fixer.target,
          packageName: entry.name,
          field: fixer.describe(),
          before: result.before ?? null,
          after: result.after ?? null,
          file: result.file ?? null,
        });
      } else {
        if (!flags.json) {
          process.stderr.write(`  SKIP  ${label} (no change needed)\n`);
        }
      }
    } catch (e) {
      if (!flags.json) {
        process.stderr.write(`  FAIL  ${label}: ${e.message}\n`);
      }
      failures++;
    }
  }

  // 7. PR mode: branch, commit, push, open PR
  let prUrl = null;
  let branchName = null;

  if (prMode && !dryRun && changes.length > 0) {
    try {
      const shellPath = join(__dirname, "..", "..", "scripts", "lib", "shell.mjs");
      const { exec } = await import(pathToFileURL(shellPath).href);

      const date = new Date().toISOString().slice(0, 10);
      branchName = `mcpt-publishing/fix-${date}`;

      if (!flags.json) {
        process.stderr.write(`\nCreating PR on branch ${branchName}...\n`);
      }

      exec(`git checkout -b "${branchName}"`, { cwd });
      exec(`git add -A`, { cwd });
      exec(`git commit -m "chore: mcpt-publishing fix (automated)"`, { cwd });
      const pushResult = exec(`git push -u origin "${branchName}"`, { cwd });

      if (pushResult.exitCode === 0) {
        const prBody = [
          "## Automated Publishing Metadata Fixes",
          "",
          `${changes.length} fix(es) applied:`,
          ...changes.map(c => `- **${c.fixerCode}**: ${c.field} on ${c.packageName}`),
          "",
          "Generated by `mcpt-publishing fix --pr`",
        ].join("\n");

        const prResult = exec(
          `gh pr create --title "chore: publishing metadata fixes" --body "${prBody.replace(/"/g, '\\"')}"`,
          { cwd }
        );

        if (prResult.exitCode === 0) {
          prUrl = prResult.stdout.trim();
          if (!flags.json) {
            process.stderr.write(`  PR created: ${prUrl}\n`);
          }
        }
      }
    } catch (e) {
      if (!flags.json) {
        process.stderr.write(`  Warning: PR creation failed: ${e.message}\n`);
      }
    }
  }

  // 8. Emit fix receipt
  const commitSha = getCommitShaSafe(cwd);
  const fixResult = {
    repo: repoFilter ?? "*",
    mode,
    dryRun,
    changes,
    auditBefore,
    prUrl,
    branchName,
    commitSha,
    fileHashes: {},
  };

  if (!dryRun) {
    try {
      const receiptPath = emitFixReceipt(config, fixResult);
      if (!flags.json) {
        process.stderr.write(`\nReceipt: ${receiptPath}\n`);
      }
    } catch (e) {
      if (!flags.json) {
        process.stderr.write(`Warning: Receipt write failed: ${e.message}\n`);
      }
    }
  }

  // 9. Summary
  if (flags.json) {
    process.stdout.write(JSON.stringify({
      mode,
      dryRun,
      changes,
      applied: changes.length,
      failures,
      prUrl,
    }, null, 2) + "\n");
  } else {
    process.stderr.write(`\nDone. ${changes.length} fixes ${dryRun ? "would be " : ""}applied, ${failures} failed.`);
    if (dryRun) process.stderr.write(` (dry-run)`);
    process.stderr.write("\n");
  }

  return failures > 0 ? EXIT.FIX_FAILURE : EXIT.SUCCESS;
}

// ─── Internal ────────────────────────────────────────────────────────────────

/** Find the repo for a finding (based on pkg field from allFindings). */
function findRepoForFinding(manifest, finding) {
  for (const [ecosystem, packages] of Object.entries(manifest)) {
    if (!Array.isArray(packages)) continue;
    for (const pkg of packages) {
      if (pkg.name === finding.pkg) return pkg.repo;
    }
  }
  return null;
}

/** Find the full entry for a finding (based on pkg + ecosystem). */
function findEntryForFinding(manifest, finding) {
  for (const [ecosystem, packages] of Object.entries(manifest)) {
    if (!Array.isArray(packages)) continue;
    for (const pkg of packages) {
      if (pkg.name === finding.pkg) {
        return { ...pkg, ecosystem };
      }
    }
  }
  return null;
}

/** Safely get commit SHA (returns null if not in a git repo). */
function getCommitShaSafe(cwd) {
  try {
    return execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
