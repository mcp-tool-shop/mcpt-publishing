/**
 * Shell utilities for publish providers.
 * Zero dependencies — uses node:child_process, node:crypto, node:fs.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

/**
 * Execute a command and capture output.
 * Does NOT throw on non-zero exit — caller decides what to do.
 *
 * @param {string} cmd - Shell command to run
 * @param {object} [opts]
 * @param {string} [opts.cwd] - Working directory
 * @param {number} [opts.timeout] - Timeout in ms (default 120s)
 * @param {object} [opts.env] - Extra environment variables (merged with process.env)
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function exec(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      encoding: "utf8",
      timeout: opts.timeout ?? 120_000,
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (e) {
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message,
      exitCode: e.status ?? 1,
    };
  }
}

/**
 * Compute SHA-256 hash and size of a file.
 *
 * @param {string} filePath - Absolute path to file
 * @returns {{ sha256: string, size: number }}
 */
export function hashFile(filePath) {
  const data = readFileSync(filePath);
  const sha256 = createHash("sha256").update(data).digest("hex");
  const { size } = statSync(filePath);
  return { sha256, size };
}

/**
 * Get the current HEAD commit SHA (40 lowercase hex chars).
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {string}
 * @throws {Error} if not in a git repo
 */
export function getCommitSha(cwd) {
  const { stdout, exitCode } = exec("git rev-parse HEAD", { cwd });
  if (exitCode !== 0) throw new Error("Not in a git repo or git not available");
  return stdout.trim();
}
