/**
 * Base class for registry providers.
 *
 * Every provider must extend this and override at least:
 *   - get name()
 *   - detect(entry)
 *   - audit(entry, ctx)
 *
 * publish() and receipt() are optional stubs for future use.
 */
export class Provider {
  /** Machine-readable name (e.g. "npm", "nuget", "pypi", "ghcr", "github") */
  get name() {
    throw new Error("Provider must define get name()");
  }

  /**
   * Does this provider apply to the given manifest entry?
   * @param {object} entry - { name, repo, audience, ecosystem }
   * @returns {boolean}
   */
  detect(entry) {
    throw new Error("not implemented");
  }

  /**
   * Audit a single package. Returns version + findings.
   * @param {object} entry - Manifest entry
   * @param {object} ctx   - Shared context { tags: Map, releases: Map }
   * @returns {Promise<{ version: string|null, findings: Array<{severity, code, msg}> }>}
   */
  async audit(entry, ctx) {
    throw new Error("not implemented");
  }

  /**
   * Plan a publish (dry-run). Override when publish support is added.
   * @param {object} entry
   * @returns {Promise<{ actions: string[] }>}
   */
  async plan(entry) {
    return { actions: [] };
  }

  /**
   * Execute a publish. Override when publish support is added.
   * @param {object} entry
   * @param {object} opts - { dryRun: boolean, version: string }
   * @returns {Promise<{ success: boolean, version: string, artifacts: object[] }>}
   */
  async publish(entry, opts) {
    throw new Error("not implemented");
  }

  /**
   * Transform a publish result into a receipt object.
   * @param {object} result - Output from publish()
   * @returns {object} Receipt data conforming to receipt.schema.json
   */
  receipt(result) {
    throw new Error("not implemented");
  }
}
