/**
 * GitHub Glue — connects receipts to GitHub Releases and the health issue.
 *
 * - attachReceiptToRelease() uploads receipt JSON as a release asset
 * - updateHealthIssueWithReceipts() appends "Recent Receipts" to the pinned issue
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Upload a receipt JSON file as a GitHub Release asset.
 * @param {string} repo        - "owner/name"
 * @param {string} tagName     - e.g. "v1.0.0"
 * @param {string} receiptPath - absolute path to the receipt JSON file
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
export function attachReceiptToRelease(repo, tagName, receiptPath) {
  try {
    // Verify the release exists
    execSync(
      `gh api repos/${repo}/releases/tags/${tagName} --jq ".id"`,
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
    );

    // Upload receipt as asset (--clobber overwrites if already attached)
    execSync(
      `gh release upload ${tagName} "${receiptPath}" --repo ${repo} --clobber`,
      { encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] }
    );

    return { success: true, url: `https://github.com/${repo}/releases/tag/${tagName}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Update the pinned "Publishing Health" issue to include receipt links.
 * Appends or replaces a "Recent Receipts" section in the issue body.
 * @param {string} repo     - The mcpt-publishing repo
 * @param {Array<{target: string, version: string, packageName: string, releaseUrl: string}>} receipts
 */
export function updateHealthIssueWithReceipts(repo, receipts) {
  try {
    // Find the pinned health issue
    const issueNum = execSync(
      `gh issue list --repo "${repo}" --search "in:title Publishing Health" --state open --json number --jq ".[0].number"`,
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!issueNum) {
      process.stderr.write("Warning: no 'Publishing Health' issue found\n");
      return;
    }

    // Get current body
    const body = execSync(
      `gh issue view ${issueNum} --repo "${repo}" --json body --jq ".body"`,
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
    );

    // Build receipt links section
    const receiptLines = receipts.map(r =>
      `- **${r.target}** ${r.packageName}@${r.version} — [release](${r.releaseUrl})`
    );

    const receiptSection = [
      "",
      "### Recent Receipts",
      ...receiptLines,
      "",
    ].join("\n");

    // Replace existing receipt section or append
    let newBody;
    if (body.includes("### Recent Receipts")) {
      newBody = body.replace(
        /### Recent Receipts[\s\S]*?(?=\n###|\n---|\n## |$)/,
        receiptSection.trim() + "\n"
      );
    } else {
      newBody = body.trimEnd() + "\n" + receiptSection;
    }

    // Write to temp file to avoid shell escaping issues
    const tmpFile = join(tmpdir(), `health-issue-${Date.now()}.md`);
    writeFileSync(tmpFile, newBody);

    execSync(
      `gh issue edit ${issueNum} --repo "${repo}" --body-file "${tmpFile}"`,
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
    );

    unlinkSync(tmpFile);
  } catch (e) {
    process.stderr.write(`Warning: failed to update health issue: ${e.message}\n`);
  }
}
