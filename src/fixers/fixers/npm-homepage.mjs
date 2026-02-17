/**
 * Fixer: npm-homepage — adds/corrects the `homepage` field in package.json.
 * Matches audit finding code: "missing-homepage"
 */

import { Fixer } from "../fixer.mjs";
import { readPkgJson, writePkgJson, readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

export default class NpmHomepageFixer extends Fixer {
  get code() { return "npm-homepage"; }
  get target() { return "npm"; }

  canFix(finding) {
    return finding.code === "missing-homepage";
  }

  describe() {
    return "Add homepage URL to package.json";
  }

  async diagnose(entry, ctx, opts = {}) {
    const expected = `https://github.com/${entry.repo}#readme`;

    if (opts.remote) {
      const remote = readRemoteFile(entry.repo, "package.json");
      if (!remote) return { needed: false };
      const data = JSON.parse(remote.content);
      if (data.homepage) return { needed: false };
      return { needed: true, before: null, after: expected, file: "package.json" };
    }

    const pkg = readPkgJson(opts.cwd ?? process.cwd());
    if (!pkg) return { needed: false };
    if (pkg.data.homepage) return { needed: false };
    return { needed: true, before: null, after: expected, file: "package.json" };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const pkg = readPkgJson(cwd);
    if (!pkg) return { changed: false };

    const before = pkg.data.homepage ?? null;
    pkg.data.homepage = `https://github.com/${entry.repo}#readme`;
    writePkgJson(pkg.path, pkg.data);

    return { changed: true, before, after: pkg.data.homepage, file: "package.json" };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const remote = readRemoteFile(entry.repo, "package.json");
    if (!remote) return { changed: false };

    const data = JSON.parse(remote.content);
    const before = data.homepage ?? null;
    data.homepage = `https://github.com/${entry.repo}#readme`;

    const ok = writeRemoteFile(
      entry.repo, "package.json",
      JSON.stringify(data, null, 2) + "\n",
      remote.sha,
      `chore: add homepage to package.json`
    );

    return { changed: ok, before, after: data.homepage, file: "package.json" };
  }
}
