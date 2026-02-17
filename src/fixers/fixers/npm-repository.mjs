/**
 * Fixer: npm-repository — corrects the `repository` field in package.json.
 * Matches audit finding code: "wrong-repo-url"
 */

import { Fixer } from "../fixer.mjs";
import { readPkgJson, writePkgJson, readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

export default class NpmRepositoryFixer extends Fixer {
  get code() { return "npm-repository"; }
  get target() { return "npm"; }

  canFix(finding) {
    return finding.code === "wrong-repo-url";
  }

  describe() {
    return "Fix npm package repository URL";
  }

  async diagnose(entry, ctx, opts = {}) {
    const expected = {
      type: "git",
      url: `git+https://github.com/${entry.repo}.git`,
    };

    if (opts.remote) {
      const remote = readRemoteFile(entry.repo, "package.json");
      if (!remote) return { needed: false };
      const data = JSON.parse(remote.content);
      const current = data.repository;
      const currentUrl = typeof current === "string" ? current : current?.url;
      if (currentUrl === expected.url) return { needed: false };
      return { needed: true, before: current ?? null, after: expected, file: "package.json" };
    }

    const pkg = readPkgJson(opts.cwd ?? process.cwd());
    if (!pkg) return { needed: false };
    const current = pkg.data.repository;
    const currentUrl = typeof current === "string" ? current : current?.url;
    if (currentUrl === expected.url) return { needed: false };
    return { needed: true, before: current ?? null, after: expected, file: "package.json" };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const pkg = readPkgJson(cwd);
    if (!pkg) return { changed: false };

    const before = pkg.data.repository ?? null;
    pkg.data.repository = {
      type: "git",
      url: `git+https://github.com/${entry.repo}.git`,
    };
    writePkgJson(pkg.path, pkg.data);

    return { changed: true, before, after: pkg.data.repository, file: "package.json" };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const remote = readRemoteFile(entry.repo, "package.json");
    if (!remote) return { changed: false };

    const data = JSON.parse(remote.content);
    const before = data.repository ?? null;
    data.repository = {
      type: "git",
      url: `git+https://github.com/${entry.repo}.git`,
    };

    const ok = writeRemoteFile(
      entry.repo, "package.json",
      JSON.stringify(data, null, 2) + "\n",
      remote.sha,
      `chore: fix repository URL in package.json`
    );

    return { changed: ok, before, after: data.repository, file: "package.json" };
  }
}
