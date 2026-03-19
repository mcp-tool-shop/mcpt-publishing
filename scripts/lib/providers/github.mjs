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
      const { stdout, exitCode } = execArgs("gh", ["api", `repos/${repo}/tags`, "--jq", ".[].name"], { timeout: 15_000 });
      if (exitCode !== 0) return [];
      return stdout.trim().split("\n").filter(Boolean);
    } catch { return []; }
  }

  #fetchReleases(repo) {
    try {
      const { stdout, exitCode } = execArgs("gh", ["api", `repos/${repo}/releases`, "--jq", ".[].tag_name"], { timeout: 15_000 });
      if (exitCode !== 0) return [];
      return stdout.trim().split("\n").filter(Boolean);
    } catch { return []; }
  }
}
