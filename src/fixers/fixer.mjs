/**
 * Fixer base class — defines the contract for allowlisted metadata fixers.
 *
 * Each fixer targets a specific audit finding code and can apply the fix
 * either locally (editing files on disk) or remotely (via GitHub API).
 */

export class Fixer {
  /**
   * Machine-readable fixer code (e.g. "npm-repository", "readme-header").
   * Must be unique across all fixers.
   * @returns {string}
   */
  get code() {
    throw new Error("Fixer subclass must override 'code'");
  }

  /**
   * Target ecosystem/scope: "npm", "nuget", "readme", "github"
   * @returns {string}
   */
  get target() {
    throw new Error("Fixer subclass must override 'target'");
  }

  /**
   * Check if this fixer can handle a given audit finding.
   * @param {object} finding - { severity, code, msg }
   * @returns {boolean}
   */
  canFix(finding) {
    throw new Error("Fixer subclass must override 'canFix'");
  }

  /**
   * Diagnose whether a fix is needed for the given entry.
   * Does NOT make changes — read-only inspection.
   *
   * @param {object} entry - Manifest entry { name, repo, audience, ecosystem }
   * @param {object} ctx   - Shared context (tags, releases, etc.)
   * @param {object} opts  - { cwd?: string, remote?: boolean }
   * @returns {Promise<{ needed: boolean, before?: any, after?: any, file?: string }>}
   */
  async diagnose(entry, ctx, opts = {}) {
    return { needed: false };
  }

  /**
   * Apply the fix locally by editing files on disk.
   *
   * @param {object} entry - Manifest entry
   * @param {object} ctx   - Shared context
   * @param {object} opts  - { cwd: string }
   * @returns {Promise<{ changed: boolean, before?: any, after?: any, file?: string }>}
   */
  async applyLocal(entry, ctx, opts = {}) {
    throw new Error(`${this.code}: applyLocal not implemented`);
  }

  /**
   * Apply the fix remotely via GitHub API (no local checkout needed).
   *
   * @param {object} entry - Manifest entry
   * @param {object} ctx   - Shared context
   * @param {object} opts  - { }
   * @returns {Promise<{ changed: boolean, before?: any, after?: any, file?: string }>}
   */
  async applyRemote(entry, ctx, opts = {}) {
    throw new Error(`${this.code}: applyRemote not implemented`);
  }

  /**
   * Human-readable description of what this fixer does.
   * @returns {string}
   */
  describe() {
    return this.code;
  }
}
