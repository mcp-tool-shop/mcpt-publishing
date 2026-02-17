/**
 * Shared helpers for npm-based fixers.
 * Handles reading/writing package.json locally and remotely.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Read package.json from a local directory.
 * @param {string} cwd - Directory containing package.json
 * @returns {{ data: object, path: string } | null}
 */
export function readPkgJson(cwd) {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  const data = JSON.parse(readFileSync(pkgPath, "utf8"));
  return { data, path: pkgPath };
}

/**
 * Write package.json back to disk (preserving indentation).
 * @param {string} pkgPath - Absolute path to package.json
 * @param {object} data    - The package.json data
 */
export function writePkgJson(pkgPath, data) {
  writeFileSync(pkgPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Read a file from a GitHub repo via the API.
 * Returns { content, sha } or null.
 *
 * @param {string} repo - "owner/name"
 * @param {string} path - File path (e.g. "package.json")
 * @returns {{ content: string, sha: string } | null}
 */
export function readRemoteFile(repo, path) {
  try {
    const raw = execSync(
      `gh api "repos/${repo}/contents/${path}" --jq "{content: .content, sha: .sha, encoding: .encoding}"`,
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const parsed = JSON.parse(raw);
    const content = Buffer.from(parsed.content, parsed.encoding || "base64").toString("utf8");
    return { content, sha: parsed.sha };
  } catch {
    return null;
  }
}

/**
 * Write a file to a GitHub repo via the API.
 *
 * @param {string} repo    - "owner/name"
 * @param {string} path    - File path
 * @param {string} content - New file content (plain text)
 * @param {string} sha     - Existing file SHA (for updates)
 * @param {string} message - Commit message
 * @returns {boolean} success
 */
export function writeRemoteFile(repo, path, content, sha, message) {
  try {
    const b64 = Buffer.from(content).toString("base64");
    const body = JSON.stringify({ message, content: b64, sha });
    execSync(
      `gh api "repos/${repo}/contents/${path}" --method PUT --input -`,
      { input: body, encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] }
    );
    return true;
  } catch {
    return false;
  }
}
