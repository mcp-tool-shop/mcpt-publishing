/**
 * Receipts index maintainer — keeps receipts/index.json current.
 *
 * The index provides a single-file view of:
 *   - Latest audit run (date, counts, totalPackages)
 *   - Latest publish per target/package (version, timestamp, commitSha)
 *
 * The Receipt Factory site can consume this file to render dashboards.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Update the index with the latest audit receipt data.
 * @param {string} receiptsDir - Absolute path to receipts directory
 * @param {object} auditReceipt - The audit receipt object
 */
export function updateReceiptsIndex(receiptsDir, auditReceipt) {
  const index = loadIndex(receiptsDir);

  index.latestAudit = {
    date: auditReceipt.timestamp,
    counts: auditReceipt.counts,
    totalPackages: auditReceipt.totalPackages,
  };

  saveIndex(receiptsDir, index);
}

/**
 * Update the index with a publish receipt entry.
 * @param {string} receiptsDir - Absolute path to receipts directory
 * @param {object} publishReceipt - A publish receipt object
 */
export function updatePublishEntry(receiptsDir, publishReceipt) {
  const index = loadIndex(receiptsDir);

  if (!index.publish) index.publish = {};

  const key = `${publishReceipt.target}/${publishReceipt.packageName}`;
  index.publish[key] = {
    version: publishReceipt.version,
    timestamp: publishReceipt.timestamp,
    commitSha: publishReceipt.commitSha,
  };

  saveIndex(receiptsDir, index);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function loadIndex(receiptsDir) {
  const indexPath = join(receiptsDir, "index.json");
  if (existsSync(indexPath)) {
    return JSON.parse(readFileSync(indexPath, "utf8"));
  }
  return { latestAudit: null, publish: {} };
}

function saveIndex(receiptsDir, index) {
  mkdirSync(receiptsDir, { recursive: true });
  const indexPath = join(receiptsDir, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
}
