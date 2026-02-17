/**
 * Audit receipt builder — emits a receipt after each audit run.
 *
 * Path: receipts/audit/<YYYY-MM-DD>.json
 * Date-keyed: latest run of the day overwrites (not immutable like publish receipts).
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
      json: "reports/latest.json",
      markdown: "reports/latest.md",
    },
  };

  const date = receipt.timestamp.slice(0, 10); // YYYY-MM-DD
  const filePath = join(auditDir, `${date}.json`);
  writeFileSync(filePath, JSON.stringify(receipt, null, 2) + "\n");

  // Update the receipts index
  updateReceiptsIndex(config.receiptsDir, receipt);

  return filePath;
}
