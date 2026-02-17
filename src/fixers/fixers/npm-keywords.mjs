/**
 * Fixer: npm-keywords — adds starter `keywords` to package.json.
 * Matches audit finding code: "missing-keywords"
 */

import { Fixer } from "../fixer.mjs";
import { readPkgJson, writePkgJson, readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

export default class NpmKeywordsFixer extends Fixer {
  get code() { return "npm-keywords"; }
  get target() { return "npm"; }

  canFix(finding) {
    return finding.code === "missing-keywords";
  }

  describe() {
    return "Add starter keywords to package.json";
  }

  #buildKeywords(entry) {
    const base = ["mcp", "mcp-tool-shop"];
    // Extract a usable keyword from package name (strip scope)
    const shortName = entry.name.replace(/^@[^/]+\//, "");
    if (shortName && !base.includes(shortName)) {
      base.push(shortName);
    }
    return base;
  }

  async diagnose(entry, ctx, opts = {}) {
    const expected = this.#buildKeywords(entry);

    if (opts.remote) {
      const remote = readRemoteFile(entry.repo, "package.json");
      if (!remote) return { needed: false };
      const data = JSON.parse(remote.content);
      if (data.keywords?.length > 0) return { needed: false };
      return { needed: true, before: null, after: expected, file: "package.json" };
    }

    const pkg = readPkgJson(opts.cwd ?? process.cwd());
    if (!pkg) return { needed: false };
    if (pkg.data.keywords?.length > 0) return { needed: false };
    return { needed: true, before: null, after: expected, file: "package.json" };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const pkg = readPkgJson(cwd);
    if (!pkg) return { changed: false };

    const before = pkg.data.keywords ?? null;
    pkg.data.keywords = this.#buildKeywords(entry);
    writePkgJson(pkg.path, pkg.data);

    return { changed: true, before, after: pkg.data.keywords, file: "package.json" };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const remote = readRemoteFile(entry.repo, "package.json");
    if (!remote) return { changed: false };

    const data = JSON.parse(remote.content);
    const before = data.keywords ?? null;
    data.keywords = this.#buildKeywords(entry);

    const ok = writeRemoteFile(
      entry.repo, "package.json",
      JSON.stringify(data, null, 2) + "\n",
      remote.sha,
      `chore: add keywords to package.json`
    );

    return { changed: ok, before, after: data.keywords, file: "package.json" };
  }
}
