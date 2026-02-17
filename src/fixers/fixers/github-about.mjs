/**
 * Fixer: github-about — fixes GitHub repo description, homepage, and topics.
 * Matches audit finding code: "missing-homepage" (at repo level)
 *
 * This fixer is always remote — it uses `gh api` to update repo metadata.
 * Has no local mode (repos don't have "About" fields on disk).
 */

import { execSync } from "node:child_process";
import { Fixer } from "../fixer.mjs";

const SITE_URL = "https://mcptoolshop.com";

export default class GitHubAboutFixer extends Fixer {
  get code() { return "github-about"; }
  get target() { return "github"; }

  canFix(finding) {
    // This fixer handles repo-level homepage (not npm-level)
    // It activates for missing-homepage when the ecosystem is github-level
    return finding.code === "missing-homepage";
  }

  describe() {
    return "Set GitHub repo homepage and description";
  }

  async diagnose(entry, ctx, opts = {}) {
    const meta = this.#fetchRepoMeta(entry.repo);
    if (!meta) return { needed: false };

    const repoName = entry.repo.split("/")[1];
    const toolUrl = `${SITE_URL}/tools/${repoName}/`;
    const changes = [];

    if (!meta.homepage || !meta.homepage.includes("mcptoolshop.com")) {
      changes.push({ field: "homepage", before: meta.homepage || null, after: toolUrl });
    }

    if (changes.length === 0) return { needed: false };

    return {
      needed: true,
      before: changes.map(c => `${c.field}: ${c.before ?? "(empty)"}`).join(", "),
      after: changes.map(c => `${c.field}: ${c.after}`).join(", "),
      file: null, // no file — GitHub API only
    };
  }

  async applyLocal(entry, ctx, opts = {}) {
    // GitHub About has no local representation — always redirect to remote
    process.stderr.write(`  ${this.code}: GitHub About can only be fixed remotely (use --remote)\n`);
    return { changed: false };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const meta = this.#fetchRepoMeta(entry.repo);
    if (!meta) return { changed: false };

    const repoName = entry.repo.split("/")[1];
    const toolUrl = `${SITE_URL}/tools/${repoName}/`;
    const updates = {};

    if (!meta.homepage || !meta.homepage.includes("mcptoolshop.com")) {
      updates.homepage = toolUrl;
    }

    if (Object.keys(updates).length === 0) return { changed: false };

    try {
      const body = JSON.stringify(updates);
      execSync(
        `gh api "repos/${entry.repo}" --method PATCH --input -`,
        { input: body, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
      );
      return {
        changed: true,
        before: meta.homepage || null,
        after: updates.homepage ?? meta.homepage,
        file: null,
      };
    } catch {
      return { changed: false };
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  #fetchRepoMeta(repo) {
    try {
      const raw = execSync(
        `gh api "repos/${repo}" --jq "{homepage: .homepage, description: .description, topics: .topics}"`,
        { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
      );
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
