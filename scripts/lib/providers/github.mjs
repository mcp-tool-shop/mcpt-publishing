/**
 * GitHub provider — context loader for tags and releases.
 *
 * This provider doesn't produce its own findings. Its job is to populate
 * ctx.tags and ctx.releases so that ecosystem providers (npm, nuget, etc.)
 * can check for drift between registry and git state.
 */

import { Provider } from "../provider.mjs";
import { execArgs } from "../shell.mjs";

export default class GitHubProvider extends Provider {
  get name() { return "github"; }

  detect(entry) {
    return !!entry.repo;
  }

  async audit(entry, ctx) {
    const repo = entry.repo;

    // SEQUENTIAL-ONLY CONTRACT: audit() must never be called concurrently for the
    // same ctx object. The has-then-set pattern below is not atomic — if two callers
    // raced on the same ctx, both could pass the has() check and set duplicate
    // promises. The audit pipeline (audit.mjs) processes entries sequentially
    // (for...of, not Promise.all) specifically to uphold this contract.
    if (!ctx.tags.has(repo)) {
      ctx.tags.set(repo, this.#fetchTags(repo));
    }
    if (!ctx.releases.has(repo)) {
      ctx.releases.set(repo, this.#fetchReleases(repo));
    }

    // No findings — this is a context loader
    return { version: null, findings: [] };
  }

  #fetchTags(repo) {
    try {
      // --paginate follows Link-header pagination automatically, handling repos
      // with more than 100 tags without manual per_page arithmetic.
      const { stdout, exitCode } = execArgs(
        "gh",
        ["api", "--paginate", `repos/${repo}/tags`, "--jq", ".[].name"],
        { timeout: 60_000 }
      );
      if (exitCode !== 0) return [];
      return stdout.trim().split("\n").filter(Boolean);
    } catch { return []; }
  }

  #fetchReleases(repo) {
    try {
      // --paginate follows Link-header pagination automatically.
      const { stdout, exitCode } = execArgs(
        "gh",
        ["api", "--paginate", `repos/${repo}/releases`, "--jq", ".[].tag_name"],
        { timeout: 60_000 }
      );
      if (exitCode !== 0) return [];
      return stdout.trim().split("\n").filter(Boolean);
    } catch { return []; }
  }
}
