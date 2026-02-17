/**
 * Fixer: readme-header — ensures README.md has a logo and site link.
 * Matches audit finding code: "missing-readme"
 *
 * Ported from scripts/storefront-fix.mjs (GitHub API version) to
 * support both local and remote modes.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Fixer } from "../fixer.mjs";
import { readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

const SITE_URL = "https://mcptoolshop.com";
const LOGO_PATHS = ["logo.png", "logo.svg", "assets/logo.png", "assets/logo.svg"];

export default class ReadmeHeaderFixer extends Fixer {
  get code() { return "readme-header"; }
  get target() { return "readme"; }

  canFix(finding) {
    return finding.code === "missing-readme";
  }

  describe() {
    return "Add logo and site link to README.md header";
  }

  async diagnose(entry, ctx, opts = {}) {
    if (opts.remote) {
      const remote = readRemoteFile(entry.repo, "README.md");
      if (!remote) return { needed: true, before: null, after: "README.md with header", file: "README.md" };
      return this.#analyzeContent(remote.content, entry);
    }

    const cwd = opts.cwd ?? process.cwd();
    const readmePath = join(cwd, "README.md");
    if (!existsSync(readmePath)) {
      return { needed: true, before: null, after: "README.md with header", file: "README.md" };
    }
    const content = readFileSync(readmePath, "utf8");
    return this.#analyzeContent(content, entry);
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const readmePath = join(cwd, "README.md");
    if (!existsSync(readmePath)) return { changed: false };

    const content = readFileSync(readmePath, "utf8");
    const newContent = this.#fixContent(content, entry, cwd);

    if (newContent === content) return { changed: false };

    writeFileSync(readmePath, newContent);
    return { changed: true, before: "(header missing)", after: "(header added)", file: "README.md" };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const remote = readRemoteFile(entry.repo, "README.md");
    if (!remote) return { changed: false };

    const newContent = this.#fixContent(remote.content, entry);
    if (newContent === remote.content) return { changed: false };

    const ok = writeRemoteFile(
      entry.repo, "README.md",
      newContent, remote.sha,
      `chore: add logo and MCP Tool Shop link to README`
    );

    return { changed: ok, before: "(header missing)", after: "(header added)", file: "README.md" };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  #analyzeContent(content, entry) {
    const firstLines = content.split("\n").slice(0, 10).join("\n");
    const hasLogo = firstLines.includes("![") || firstLines.includes("<img");
    const hasSiteLink = content.includes(SITE_URL) || content.includes("mcptoolshop.com") || content.includes("MCP Tool Shop");

    if (hasLogo && hasSiteLink) return { needed: false };

    const changes = [];
    if (!hasLogo) changes.push("logo");
    if (!hasSiteLink) changes.push("site link");

    return {
      needed: true,
      before: `Missing: ${changes.join(", ")}`,
      after: "Logo + site link in header",
      file: "README.md",
    };
  }

  #fixContent(content, entry, cwd = null) {
    let result = content;
    const repoName = entry.repo.split("/")[1];

    // Detect existing logo path
    let logoPath = "logo.png";
    if (cwd) {
      for (const p of LOGO_PATHS) {
        if (existsSync(join(cwd, p))) {
          logoPath = p;
          break;
        }
      }
    }

    // Check if logo is in the first 10 lines
    const firstLines = result.split("\n").slice(0, 10).join("\n");
    const hasLogo = firstLines.includes("![") || firstLines.includes("<img");

    if (!hasLogo) {
      const logoHeader = `<p align="center">\n  <img src="${logoPath}" width="200" alt="${repoName}">\n</p>\n\n`;
      result = logoHeader + result;
    }

    // Check for site link
    const hasSiteLink = result.includes(SITE_URL) || result.includes("mcptoolshop.com") || result.includes("MCP Tool Shop");

    if (!hasSiteLink) {
      const headingMatch = result.match(/^#\s+.+$/m);
      if (headingMatch) {
        const idx = result.indexOf(headingMatch[0]) + headingMatch[0].length;
        const catalogLine = `\n\n> Part of [MCP Tool Shop](${SITE_URL})`;
        result = result.slice(0, idx) + catalogLine + result.slice(idx);
      } else {
        result = result + `\n\n> Part of [MCP Tool Shop](${SITE_URL})\n`;
      }
    }

    return result;
  }
}
