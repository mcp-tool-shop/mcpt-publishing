/**
 * `mcpt-publishing verify-receipt` — validate a receipt file.
 *
 * Checks:
 *   1. File exists and is readable
 *   2. Valid JSON
 *   3. Schema validation (publish or audit receipt)
 *   4. SHA-256 integrity hash (for reference/verification)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { EXIT } from "../cli/exit-codes.mjs";

export const helpText = `
mcpt-publishing verify-receipt — Validate a receipt file.

Usage:
  mcpt-publishing verify-receipt <path> [flags]

Arguments:
  <path>        Path to the receipt JSON file

Flags:
  --json        Output result as JSON
  --help        Show this help

Checks:
  1. File exists and is readable
  2. Valid JSON parse
  3. Schema validation (publish or audit receipt)
  4. SHA-256 content integrity hash

Exit codes:
  0   Receipt is valid
  3   Validation failed
`.trim();

/** Required fields for audit receipts. */
const AUDIT_REQUIRED = ["schemaVersion", "type", "timestamp", "counts", "totalPackages"];

/** Required fields for publish receipts. */
const PUBLISH_REQUIRED = ["schemaVersion", "repo", "target", "version", "packageName", "commitSha", "timestamp", "artifacts"];

const VALID_TARGETS = ["npm", "nuget", "pypi", "ghcr"];

/**
 * Execute the verify-receipt command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  const receiptPath = flags._positionals[0];

  if (!receiptPath) {
    process.stderr.write("Error: receipt path is required.\n");
    process.stderr.write("Usage: mcpt-publishing verify-receipt <path>\n");
    return EXIT.CONFIG_ERROR;
  }

  const absPath = resolve(receiptPath);
  const checks = [];

  // Check 1: File exists
  if (!existsSync(absPath)) {
    checks.push({ check: "exists", pass: false, msg: `File not found: ${absPath}` });
    return output(checks, flags);
  }
  checks.push({ check: "exists", pass: true });

  // Check 2: Valid JSON
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(absPath, "utf8"));
    checks.push({ check: "json", pass: true });
  } catch (e) {
    checks.push({ check: "json", pass: false, msg: `Invalid JSON: ${e.message}` });
    return output(checks, flags);
  }

  // Check 3: Schema validation
  // Detect receipt type: audit receipts have type="audit", publish receipts have "target"
  if (receipt.type === "audit") {
    const missing = AUDIT_REQUIRED.filter(f => !(f in receipt));
    if (missing.length > 0) {
      checks.push({ check: "schema", pass: false, type: "audit", msg: `Missing fields: ${missing.join(", ")}` });
    } else {
      checks.push({ check: "schema", pass: true, type: "audit" });
    }
  } else if (receipt.target || receipt.packageName) {
    // Publish receipt — validate against full schema
    const missing = PUBLISH_REQUIRED.filter(f => !(f in receipt));
    if (missing.length > 0) {
      checks.push({ check: "schema", pass: false, type: "publish", msg: `Missing fields: ${missing.join(", ")}` });
    } else {
      // Deep validation
      const errors = validatePublishReceipt(receipt);
      if (errors.length > 0) {
        checks.push({ check: "schema", pass: false, type: "publish", msg: errors.join("; ") });
      } else {
        checks.push({ check: "schema", pass: true, type: "publish" });
      }
    }
  } else {
    checks.push({ check: "schema", pass: false, msg: "Unknown receipt type (no 'type' or 'target' field)" });
  }

  // Check 4: Compute SHA-256 integrity hash
  const content = readFileSync(absPath);
  const sha256 = createHash("sha256").update(content).digest("hex");
  checks.push({ check: "integrity", pass: true, sha256 });

  return output(checks, flags);
}

/**
 * Validate publish receipt fields beyond presence checks.
 * @param {object} r - Receipt object
 * @returns {string[]} Error messages (empty = valid)
 */
function validatePublishReceipt(r) {
  const errors = [];

  if (r.schemaVersion !== "1.0.0") {
    errors.push(`Unknown schemaVersion: ${r.schemaVersion}`);
  }
  if (typeof r.repo !== "object" || !r.repo.owner || !r.repo.name) {
    errors.push("repo must have owner and name");
  }
  if (!VALID_TARGETS.includes(r.target)) {
    errors.push(`Invalid target: ${r.target}`);
  }
  if (typeof r.commitSha !== "string" || !/^[0-9a-f]{40}$/.test(r.commitSha)) {
    errors.push("commitSha must be 40 lowercase hex characters");
  }
  if (!Array.isArray(r.artifacts)) {
    errors.push("artifacts must be an array");
  } else {
    for (const art of r.artifacts) {
      if (!art.name) errors.push("artifact missing name");
      if (typeof art.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(art.sha256)) {
        errors.push(`artifact ${art.name ?? "?"} has invalid sha256`);
      }
      if (typeof art.size !== "number" || art.size < 0) {
        errors.push(`artifact ${art.name ?? "?"} has invalid size`);
      }
      if (!art.url) errors.push(`artifact ${art.name ?? "?"} missing url`);
    }
  }

  return errors;
}

/**
 * Output check results and return exit code.
 */
function output(checks, flags) {
  const allPass = checks.every(c => c.pass);

  if (flags.json) {
    process.stdout.write(JSON.stringify({ valid: allPass, checks }, null, 2) + "\n");
  } else {
    for (const c of checks) {
      const icon = c.pass ? "PASS" : "FAIL";
      const detail = c.msg ? ` — ${c.msg}` : "";
      const extra = c.sha256 ? ` (sha256: ${c.sha256.slice(0, 16)}...)` : "";
      const typeNote = c.type ? ` [${c.type}]` : "";
      process.stderr.write(`  ${icon}  ${c.check}${typeNote}${detail}${extra}\n`);
    }
    process.stderr.write(`\n${allPass ? "Receipt is valid." : "Receipt validation FAILED."}\n`);
  }

  return allPass ? EXIT.SUCCESS : EXIT.CONFIG_ERROR;
}
