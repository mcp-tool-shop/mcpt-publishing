/**
 * Audit receipt builder — emits a receipt after each audit run.
 *
 * Path: receipts/audit/<YYYY-MM-DD-HH-MM-SS>.json
 * Timestamp-keyed: each run gets a unique file, no overwrites.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { updateReceiptsIndex } from "./index-writer.mjs";

/**
 * Build and write an audit receipt from audit results.
 * @param {object} config  - Resolved config (needs config.receiptsDir)
 * @param {object} results - Audit results { npm:[], nuget:[], counts:{}, generated }
 * @returns {string} Path to the written receipt file
 */
export function emitAuditReceipt(config, results) {
  const auditDir = join(config.receiptsDir, "audit");
  mkdirSync(auditDir, { recursive: true });

  // Count packages per ecosystem
  const ecosystems = {};
  let totalPackages = 0;
  for (const [key, val] of Object.entries(results)) {
    if (Array.isArray(val)) {
      ecosystems[key] = val.length;
      totalPackages += val.length;
    }
  }

  const receipt = {
    schemaVersion: "1.0.0",
    type: "audit",
    timestamp: new Date().toISOString(),
    counts: results.counts,
    ecosystems,
    totalPackages,
    reportFiles: {
      json: join(config.reportsDir, "latest.json"),
      markdown: join(config.reportsDir, "latest.md"),
    },
  };

  // Build YYYY-MM-DD-HH-MM-SS from ISO timestamp for unique, sortable filenames.
  // e.g. "2026-03-30T14:05:22.000Z" → "2026-03-30-14-05-22"
  const datePart = receipt.timestamp.slice(0, 10);           // YYYY-MM-DD
  const timePart = receipt.timestamp.slice(11, 19).replace(/:/g, "-"); // HH-MM-SS
  const filePath = join(auditDir, `${datePart}-${timePart}.json`);
  writeFileSync(filePath, JSON.stringify(receipt, null, 2) + "\n");

  // Update the receipts index
  updateReceiptsIndex(config.receiptsDir, receipt);

  return filePath;
}
