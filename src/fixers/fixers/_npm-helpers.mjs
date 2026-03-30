/**
 * Shared helpers for npm-based fixers.
 * Handles reading/writing package.json locally and remotely.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/** Cached result of gh CLI availability check. */
let _ghAvailable = null;

/**
 * Check whether the `gh` CLI is installed and authenticated.
 * Result is cached after the first call.
 * Throws a structured error if gh is not found.
 */
export function isGhAvailable() {
  if (_ghAvailable !== null) return _ghAvailable;
  try {
    execFileSync("gh", ["--version"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    _ghAvailable = true;
  } catch {
    _ghAvailable = false;
    const err = new Error("gh CLI not found — install GitHub CLI and run gh auth login");
    err.code = "GH_CLI_NOT_FOUND";
    throw err;
  }
  return _ghAvailable;
}

/**
 * Read package.json from a local directory.
 * @param {string} cwd - Directory containing package.json
 * @returns {{ data: object, path: string } | null}
 */
export function readPkgJson(cwd) {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  let data;
  try {
    data = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch (e) {
    process.stderr.write(`  readPkgJson: failed to parse ${pkgPath}: ${e.message}\n`);
    return null;
  }
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

/** Validate repo and path params used in GitHub API calls. */
function validateRepoAndPath(repo, path) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/name" with alphanumeric, hyphen, underscore, or dot characters only.`);
  }
  if (path.includes("..")) {
    throw new Error(`Invalid path: "${path}". Path must not contain ".." sequences.`);
  }
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
  isGhAvailable(); // throws structured error if gh CLI is missing
  validateRepoAndPath(repo, path);
  try {
    const raw = execFileSync(
      "gh", ["api", `repos/${repo}/contents/${path}`, "--jq", "{content: .content, sha: .sha, encoding: .encoding}"],
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const parsed = JSON.parse(raw);
    const content = Buffer.from(parsed.content, parsed.encoding || "base64").toString("utf8");
    return { content, sha: parsed.sha };
  } catch (e) {
    process.stderr.write(`  readRemoteFile: ${repo}/${path} failed: ${e.message}\n`);
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
  validateRepoAndPath(repo, path);
  try {
    const b64 = Buffer.from(content).toString("base64");
    const body = JSON.stringify({ message, content: b64, sha });
    execFileSync(
      "gh", ["api", `repos/${repo}/contents/${path}`, "--method", "PUT", "--input", "-"],
      { input: body, encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] }
    );
    return true;
  } catch (e) {
    process.stderr.write(`  writeRemoteFile: ${repo}/${path} failed: ${e.message}\n`);
    return false;
  }
}
