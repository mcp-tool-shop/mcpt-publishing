/**
 * Fixer: git-tag-missing — diagnostic-only fixer for 'published-not-tagged'.
 * Matches audit finding code: "published-not-tagged"
 *
 * This fixer cannot automate the git tag operation safely (it would need to
 * push to the repo's default branch or create a signed tag). Instead it
 * prints the exact commands the operator must run and returns { changed: false }.
 */

import { Fixer } from "../fixer.mjs";

export default class GitTagMissingFixer extends Fixer {
  get code() { return "git-tag-missing"; }
  get target() { return "github"; }

  canFix(finding) {
    return finding.code === "published-not-tagged";
  }

  describe() {
    return "Diagnose missing git tag for published version (manual action required)";
  }

  async diagnose(entry, ctx, opts = {}) {
    // The published version is stored on the finding; fall back to ctx tags if available.
    const version = entry.version && entry.version !== "?" ? entry.version : null;
    if (!version) {
      return { needed: false };
    }

    const expectedTag = `v${version}`;
    return {
      needed: true,
      before: null,
      after: expectedTag,
      file: null,
      note: `Run: git tag ${expectedTag} && git push origin ${expectedTag}`,
    };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const version = entry.version && entry.version !== "?" ? entry.version : null;
    const expectedTag = version ? `v${version}` : "<version>";
    process.stdout.write(
      `\n  [git-tag-missing] Cannot automate git tag creation safely.\n` +
      `  Run the following commands in the repo directory:\n\n` +
      `    git tag ${expectedTag} && git push origin ${expectedTag}\n\n`
    );
    return { changed: false };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const version = entry.version && entry.version !== "?" ? entry.version : null;
    const expectedTag = version ? `v${version}` : "<version>";
    process.stdout.write(
      `\n  [git-tag-missing] Cannot automate git tag creation safely.\n` +
      `  Run the following commands in the repo directory:\n\n` +
      `    git tag ${expectedTag} && git push origin ${expectedTag}\n\n`
    );
    return { changed: false };
  }
}
