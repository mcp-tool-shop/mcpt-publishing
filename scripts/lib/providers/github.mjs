/**
 * GitHub provider — context loader for tags and releases.
 *
 * This provider doesn't produce its own findings. Its job is to populate
 * ctx.tags and ctx.releases so that ecosystem providers (npm, nuget, etc.)
 * can check for drift between registry and git state.
 */

import { execSync } from "node:child_process";
import { Provider } from "../provider.mjs";

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
      const raw = execSync(
        `gh api repos/${repo}/tags --jq ".[].name" 2>&1`,
        { encoding: "utf8", timeout: 15_000 }
      );
      return raw.trim().split("\n").filter(Boolean);
    } catch { return []; }
  }

  #fetchReleases(repo) {
    try {
      const raw = execSync(
        `gh api repos/${repo}/releases --jq ".[].tag_name" 2>&1`,
        { encoding: "utf8", timeout: 15_000 }
      );
      return raw.trim().split("\n").filter(Boolean);
    } catch { return []; }
  }
}
