/**
 * `mcpt-publishing weekly` — orchestrates audit → fix → optionally publish.
 *
 * A composite command that runs the golden path in one shot.
 *
 * Flags:
 *   --dry-run   Audit + fix --dry-run (preview only)
 *   --pr        Audit + fix --pr (create PR with fixes)
 *   --publish   Audit + fix + publish (explicit flag required)
 *   --repo      Filter to a single repo
 *   --target    Filter to a single ecosystem
 *   --json      JSON output
 *   --help      Show help
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EXIT } from "../cli/exit-codes.mjs";

export const helpText = `
mcpt-publishing weekly — Audit, fix, and optionally publish in one command.

Usage:
  mcpt-publishing weekly [flags]

Flags:
  --dry-run             Audit + preview fixes (no writes)
  --pr                  Audit + apply fixes as a PR
  --publish             Audit + fix + publish (requires explicit flag)
  --repo <owner/name>   Filter to one repo
  --target <ecosystem>  Filter to one ecosystem (npm, nuget)
  --remote              Apply fixes via GitHub API (no local checkout)
  --json                Output results as JSON
  --help                Show this help

Modes:
  Default               Audit + fix (local, no publish)
  --dry-run             Audit + fix preview (no writes)
  --pr                  Audit + fix + open PR
  --publish             Audit + fix + publish + receipts

Exit codes:
  0   All steps succeeded
  2   RED drift found (audit-only, no fix applied)
  5   Publish failure
  6   Fix failure

Examples:
  mcpt-publishing weekly --dry-run               # preview everything
  mcpt-publishing weekly --pr                     # audit + fix PR
  mcpt-publishing weekly --publish --dry-run      # preview full pipeline
  mcpt-publishing weekly --publish                # the real deal
`.trim();

/**
 * Execute the weekly command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  // Propagate --config to sub-commands via env so audit/fix/publish all see the
  // same config file without each sub-command needing explicit flag forwarding.
  // Contract: PUBLISHING_CONFIG is set once here; sub-commands read it from env.
  if (flags.config) {
    const { resolve } = await import("node:path");
    process.env.PUBLISHING_CONFIG = resolve(flags.config);
  }

  const dryRun = !!flags["dry-run"];
  const doPublish = !!flags.publish;
  const json = !!flags.json;

  const results = { audit: null, fix: null, publish: null };

  // ─── Step 1: Audit ──────────────────────────────────────────────────────────
  if (!json) process.stderr.write("═══ Step 1/3: Audit ═══\n\n");

  const auditMod = await import("./audit.mjs");
  // Known gap: audit JSON output is suppressed here so it doesn't pollute the weekly
  // --json result. As a consequence, individual finding details are not included in the
  // weekly --json output — only the audit exit code is captured in results.audit.exitCode.
  // Workaround: re-run `mcpt-publishing audit --json` separately to get the full findings list.
  const auditFlags = { ...flags, json: false }; // Suppress JSON for intermediate steps
  // We don't want audit to call process.exit, so we catch its exit code
  // Note: config is loaded independently inside audit and fix execute calls. The
  // double-load is acceptable at current scale (two fast synchronous reads).
  const auditCode = await auditMod.execute(auditFlags);
  results.audit = { exitCode: auditCode };

  if (!json) {
    process.stderr.write(`\nAudit: exit ${auditCode}\n\n`);
  }

  if (auditCode !== EXIT.SUCCESS && auditCode !== EXIT.DRIFT_FOUND) {
    if (json) {
      process.stdout.write(JSON.stringify({ results, error: "Audit step failed with unrecoverable error" }, null, 2) + "\n");
    } else {
      process.stderr.write(`Weekly aborted: audit returned exit ${auditCode} (unrecoverable).\n`);
    }
    return auditCode;
  }

  // ─── Step 2: Fix ────────────────────────────────────────────────────────────
  if (!json) process.stderr.write("═══ Step 2/3: Fix ═══\n\n");

  const fixMod = await import("./fix.mjs");
  const fixFlags = {
    ...flags,
    json: false,
  };

  const fixCode = await fixMod.execute(fixFlags);
  results.fix = { exitCode: fixCode };

  if (!json) {
    process.stderr.write(`\nFix: exit ${fixCode}\n\n`);
  }

  if (fixCode === EXIT.FIX_FAILURE) {
    if (json) {
      process.stdout.write(JSON.stringify({ results, error: "Fix step failed" }, null, 2) + "\n");
    } else {
      process.stderr.write("Weekly aborted: fix step failed.\n");
    }
    return EXIT.FIX_FAILURE;
  }

  // ─── Step 3: Publish (only if --publish) ────────────────────────────────────
  if (doPublish) {
    if (!json) process.stderr.write("═══ Step 3/3: Publish ═══\n\n");

    const publishMod = await import("./publish.mjs");
    const publishFlags = {
      ...flags,
      json: false,
    };

    const publishCode = await publishMod.execute(publishFlags);
    results.publish = { exitCode: publishCode };

    if (!json) {
      process.stderr.write(`\nPublish: exit ${publishCode}\n\n`);
    }

    if (publishCode !== EXIT.SUCCESS) {
      if (json) {
        process.stdout.write(JSON.stringify({ results, error: "Publish step failed" }, null, 2) + "\n");
      }
      return publishCode;
    }
  } else {
    if (!json) process.stderr.write("═══ Step 3/3: Publish (skipped — pass --publish to enable) ═══\n\n");
    results.publish = { skipped: true };
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  if (json) {
    // Enrich JSON output with findings from reports/latest.json if available
    let findings = null;
    try {
      // Determine reports dir: load config to find reportsDir
      const { loadConfig } = await import("../config/loader.mjs");
      const cfg = loadConfig();
      const latestJsonPath = join(cfg.reportsDir, "latest.json");
      if (existsSync(latestJsonPath)) {
        findings = JSON.parse(readFileSync(latestJsonPath, "utf8"));
      }
    } catch {
      // Best-effort — don't fail weekly if we can't read the report
    }
    const output = findings !== null ? { results, findings } : { results };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    process.stderr.write("═══ Weekly Summary ═══\n");
    process.stderr.write(`  Audit:   exit ${results.audit.exitCode}\n`);
    process.stderr.write(`  Fix:     exit ${results.fix.exitCode}\n`);
    process.stderr.write(`  Publish: ${results.publish.skipped ? "skipped" : `exit ${results.publish.exitCode}`}\n`);
    process.stderr.write(`\nDone.${dryRun ? " (dry-run)" : ""}\n`);
  }

  return EXIT.SUCCESS;
}
