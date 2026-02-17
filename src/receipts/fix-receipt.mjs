/**
 * Fix receipt builder — emits a receipt after each fix run.
 *
 * Path: receipts/fix/<YYYY-MM-DD>-<slug>.json
 * Date-keyed with repo slug: overwrites within the same day for same repo.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { updateFixEntry } from "./index-writer.mjs";

/**
 * Build and write a fix receipt.
 *
 * @param {object} config     - Resolved config (needs config.receiptsDir)
 * @param {object} fixResult  - Fix results:
 *   { repo, mode, dryRun, changes[], auditBefore, auditAfter, commitSha?, prUrl?, branchName?, fileHashes? }
 * @returns {string} Path to the written receipt file
 */
export function emitFixReceipt(config, fixResult) {
  const fixDir = join(config.receiptsDir, "fix");
  mkdirSync(fixDir, { recursive: true });

  const receipt = {
    schemaVersion: "1.0.0",
    type: "fix",
    timestamp: new Date().toISOString(),
    repo: fixResult.repo ?? "*",
    mode: fixResult.mode,
    dryRun: fixResult.dryRun ?? false,
    prUrl: fixResult.prUrl ?? null,
    branchName: fixResult.branchName ?? null,
    changes: fixResult.changes ?? [],
    auditBefore: fixResult.auditBefore ?? null,
    auditAfter: fixResult.auditAfter ?? null,
    commitSha: fixResult.commitSha ?? null,
    fileHashes: fixResult.fileHashes ?? {},
  };

  const date = receipt.timestamp.slice(0, 10); // YYYY-MM-DD
  const slug = (fixResult.repo ?? "fleet").replace(/\//g, "--");
  const filePath = join(fixDir, `${date}-${slug}.json`);
  writeFileSync(filePath, JSON.stringify(receipt, null, 2) + "\n");

  // Update the receipts index
  updateFixEntry(config.receiptsDir, receipt);

  return filePath;
}
