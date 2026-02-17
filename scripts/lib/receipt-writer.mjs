/**
 * Receipt writer — validates and persists publish receipts.
 *
 * Receipts are immutable once written (append-only directory).
 * Path: receipts/publish/<owner>--<name>/<target>/<version>.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const VALID_TARGETS = ["npm", "nuget", "pypi", "ghcr"];

/**
 * Validate receipt data against the receipt schema (lightweight, no Ajv).
 * @param {object} receipt
 * @throws {Error} on validation failure
 */
export function validate(receipt) {
  if (!receipt || typeof receipt !== "object") throw new Error("Receipt must be an object");

  // Required top-level fields
  const required = ["schemaVersion", "repo", "target", "version", "packageName", "commitSha", "timestamp", "artifacts"];
  for (const field of required) {
    if (!(field in receipt)) throw new Error(`Receipt missing required field: ${field}`);
  }

  // schemaVersion
  if (receipt.schemaVersion !== "1.0.0") {
    throw new Error(`Unknown schemaVersion: ${receipt.schemaVersion}`);
  }

  // repo
  if (typeof receipt.repo !== "object" || !receipt.repo.owner || !receipt.repo.name) {
    throw new Error("repo must have owner and name");
  }

  // target
  if (!VALID_TARGETS.includes(receipt.target)) {
    throw new Error(`Invalid target: ${receipt.target} (expected one of ${VALID_TARGETS.join(", ")})`);
  }

  // version
  if (typeof receipt.version !== "string" || !receipt.version) {
    throw new Error("version must be a non-empty string");
  }

  // packageName
  if (typeof receipt.packageName !== "string" || !receipt.packageName) {
    throw new Error("packageName must be a non-empty string");
  }

  // commitSha — 40 hex chars
  if (typeof receipt.commitSha !== "string" || !/^[0-9a-f]{40}$/.test(receipt.commitSha)) {
    throw new Error("commitSha must be a 40-character lowercase hex string");
  }

  // timestamp — ISO 8601
  if (typeof receipt.timestamp !== "string" || !receipt.timestamp) {
    throw new Error("timestamp must be a non-empty string");
  }

  // artifacts
  if (!Array.isArray(receipt.artifacts)) {
    throw new Error("artifacts must be an array");
  }
  for (const art of receipt.artifacts) {
    if (!art.name || typeof art.name !== "string") throw new Error("artifact.name required");
    if (typeof art.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(art.sha256)) {
      throw new Error(`Invalid artifact sha256: ${art.sha256}`);
    }
    if (typeof art.size !== "number" || art.size < 0 || !Number.isInteger(art.size)) {
      throw new Error(`Invalid artifact size: ${art.size}`);
    }
    if (!art.url || typeof art.url !== "string") throw new Error("artifact.url required");
  }
}

/**
 * Build the filesystem path for a receipt.
 * @param {object} receipt
 * @returns {string} Absolute path
 */
function receiptPath(receipt) {
  const slug = `${receipt.repo.owner}--${receipt.repo.name}`;
  return join(ROOT, "receipts", "publish", slug, receipt.target, `${receipt.version}.json`);
}

/**
 * Write a receipt to the immutable store.
 * @param {object} receipt - Validated receipt data
 * @returns {string} Absolute path of written receipt
 * @throws {Error} if receipt already exists (immutability) or validation fails
 */
export function write(receipt) {
  validate(receipt);

  const filePath = receiptPath(receipt);

  if (existsSync(filePath)) {
    throw new Error(`Receipt already exists (immutable): ${filePath}`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(receipt, null, 2) + "\n");
  return filePath;
}

/**
 * Read an existing receipt.
 * @param {string} repoSlug - "owner--name"
 * @param {string} target   - "npm" | "nuget" | "pypi" | "ghcr"
 * @param {string} version
 * @returns {object|null}
 */
export function read(repoSlug, target, version) {
  const filePath = join(ROOT, "receipts", "publish", repoSlug, target, `${version}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}
