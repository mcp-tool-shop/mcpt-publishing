/**
 * Fixer: npm-bugs — adds the `bugs.url` field to package.json.
 * Matches audit finding code: "missing-bugs-url"
 */

import { Fixer } from "../fixer.mjs";
import { readPkgJson, writePkgJson, readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

export default class NpmBugsFixer extends Fixer {
  get code() { return "npm-bugs"; }
  get target() { return "npm"; }

  canFix(finding) {
    return finding.code === "missing-bugs-url";
  }

  describe() {
    return "Add bugs URL to package.json";
  }

  async diagnose(entry, ctx, opts = {}) {
    const expected = `https://github.com/${entry.repo}/issues`;

    if (opts.remote) {
      const remote = readRemoteFile(entry.repo, "package.json");
      if (!remote) return { needed: false };
      const data = JSON.parse(remote.content);
      if (data.bugs?.url) return { needed: false };
      return { needed: true, before: null, after: expected, file: "package.json" };
    }

    const pkg = readPkgJson(opts.cwd ?? process.cwd());
    if (!pkg) return { needed: false };
    if (pkg.data.bugs?.url) return { needed: false };
    return { needed: true, before: null, after: expected, file: "package.json" };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const pkg = readPkgJson(cwd);
    if (!pkg) return { changed: false };

    const before = pkg.data.bugs ?? null;
    pkg.data.bugs = { url: `https://github.com/${entry.repo}/issues` };
    writePkgJson(pkg.path, pkg.data);

    return { changed: true, before, after: pkg.data.bugs, file: "package.json" };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const remote = readRemoteFile(entry.repo, "package.json");
    if (!remote) return { changed: false };

    const data = JSON.parse(remote.content);
    const before = data.bugs ?? null;
    data.bugs = { url: `https://github.com/${entry.repo}/issues` };

    const ok = writeRemoteFile(
      entry.repo, "package.json",
      JSON.stringify(data, null, 2) + "\n",
      remote.sha,
      `chore: add bugs URL to package.json`
    );

    return { changed: ok, before, after: data.bugs, file: "package.json" };
  }
}
