/**
 * Fixer: npm-description — adds/corrects the `description` field in package.json.
 * Matches audit finding code: "bad-description" with ecosystem "npm"
 */

import { Fixer } from "../fixer.mjs";
import { readPkgJson, writePkgJson, readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

/** Trim leading/trailing whitespace and collapse internal runs of whitespace. */
function cleanDescription(raw) {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export default class NpmDescriptionFixer extends Fixer {
  get code() { return "npm-description"; }
  get target() { return "npm"; }

  canFix(finding) {
    return finding.code === "bad-description" && finding.ecosystem === "npm";
  }

  describe() {
    return "Clean description field in package.json";
  }

  async diagnose(entry, ctx, opts = {}) {
    if (opts.remote) {
      const remote = readRemoteFile(entry.repo, "package.json");
      if (!remote) return { needed: false };
      let data;
      try {
        data = JSON.parse(remote.content);
      } catch (e) {
        process.stderr.write(`  npm-description: failed to parse package.json for ${entry.repo}: ${e.message}\n`);
        return { needed: false };
      }
      const before = data.description ?? null;
      const after = cleanDescription(before);
      if (before === after && before) return { needed: false };
      return { needed: true, before, after, file: "package.json" };
    }

    const pkg = readPkgJson(opts.cwd ?? process.cwd());
    if (!pkg) return { needed: false };
    const before = pkg.data.description ?? null;
    const after = cleanDescription(before);
    if (before === after && before) return { needed: false };
    return { needed: true, before, after, file: "package.json" };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const pkg = readPkgJson(cwd);
    if (!pkg) return { changed: false };

    const before = pkg.data.description ?? null;
    const after = cleanDescription(before);

    if (before === after && before) return { changed: false };

    pkg.data.description = after;
    writePkgJson(pkg.path, pkg.data);

    return { changed: true, before, after, file: "package.json" };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const remote = readRemoteFile(entry.repo, "package.json");
    if (!remote) return { changed: false };

    let data;
    try {
      data = JSON.parse(remote.content);
    } catch (e) {
      process.stderr.write(`  npm-description: failed to parse package.json for ${entry.repo}: ${e.message}\n`);
      return { changed: false };
    }

    const before = data.description ?? null;
    const after = cleanDescription(before);

    if (before === after && before) return { changed: false };

    data.description = after;

    const ok = writeRemoteFile(
      entry.repo, "package.json",
      JSON.stringify(data, null, 2) + "\n",
      remote.sha,
      `chore: clean description in package.json`
    );

    return { changed: ok, before, after, file: "package.json" };
  }
}
