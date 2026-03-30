/**
 * Fixer: nuget-csproj — adds/fixes metadata fields in .csproj.
 * Matches audit finding code: "missing-project-url"
 *
 * Handles: PackageProjectUrl, RepositoryUrl, PackageIcon, PackageReadmeFile
 * Uses string manipulation (no XML parser, zero deps).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Fixer } from "../fixer.mjs";
import { readRemoteFile, writeRemoteFile } from "./_npm-helpers.mjs";

export default class NuGetCsprojFixer extends Fixer {
  get code() { return "nuget-csproj"; }
  get target() { return "nuget"; }

  canFix(finding) {
    return finding.code === "missing-project-url";
  }

  describe() {
    return "Add PackageProjectUrl and RepositoryUrl to .csproj";
  }

  async diagnose(entry, ctx, opts = {}) {
    const repoUrl = `https://github.com/${entry.repo}`;
    const projectUrl = `${repoUrl}#readme`;

    if (opts.remote) {
      // Find csproj remotely — check common paths
      const csprojPath = await this.#findCsprojRemote(entry);
      if (!csprojPath) return { needed: false };

      const remote = readRemoteFile(entry.repo, csprojPath);
      if (!remote) return { needed: false };

      const needs = this.#analyzeCsproj(remote.content);
      if (needs.length === 0) return { needed: false };

      return {
        needed: true,
        before: needs.map(n => `${n}: (missing)`).join(", "),
        after: needs.map(n => `${n}: (set)`).join(", "),
        file: csprojPath,
      };
    }

    const cwd = opts.cwd ?? process.cwd();
    const csprojPath = this.#findCsprojLocal(cwd, entry.name);
    if (!csprojPath) return { needed: false };

    let content;
    try {
      content = readFileSync(csprojPath, "utf8");
    } catch (e) {
      process.stderr.write(`  nuget-csproj: failed to read ${csprojPath}: ${e.message}\n`);
      return { needed: false };
    }
    const needs = this.#analyzeCsproj(content);
    if (needs.length === 0) return { needed: false };

    return {
      needed: true,
      before: needs.map(n => `${n}: (missing)`).join(", "),
      after: needs.map(n => `${n}: (set)`).join(", "),
      file: csprojPath,
    };
  }

  async applyLocal(entry, ctx, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const csprojPath = this.#findCsprojLocal(cwd, entry.name);
    if (!csprojPath) return { changed: false };

    let content;
    try {
      content = readFileSync(csprojPath, "utf8");
    } catch (e) {
      process.stderr.write(`  nuget-csproj: failed to read ${csprojPath}: ${e.message}\n`);
      return { changed: false };
    }
    const repoUrl = `https://github.com/${entry.repo}`;
    const projectUrl = `${repoUrl}#readme`;
    const newContent = this.#fixCsproj(content, repoUrl, projectUrl);

    if (newContent === content) return { changed: false };

    const needs = this.#analyzeCsproj(content);
    writeFileSync(csprojPath, newContent);
    return {
      changed: true,
      before: needs.map(n => `${n}: (missing)`).join(", "),
      after: needs.map(n => `${n}: (set)`).join(", "),
      file: csprojPath,
    };
  }

  async applyRemote(entry, ctx, opts = {}) {
    const csprojPath = await this.#findCsprojRemote(entry);
    if (!csprojPath) return { changed: false };

    const remote = readRemoteFile(entry.repo, csprojPath);
    if (!remote) return { changed: false };

    const repoUrl = `https://github.com/${entry.repo}`;
    const projectUrl = `${repoUrl}#readme`;
    const newContent = this.#fixCsproj(remote.content, repoUrl, projectUrl);

    if (newContent === remote.content) return { changed: false };

    const ok = writeRemoteFile(
      entry.repo, csprojPath, newContent, remote.sha,
      `chore: add NuGet metadata to ${csprojPath}`
    );

    return { changed: ok, before: "(missing metadata)", after: "(metadata added)", file: csprojPath };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Find a .csproj file locally that matches the NuGet package name. */
  #findCsprojLocal(cwd, packageName) {
    // Look for <PackageName>.csproj or any .csproj in cwd and one level down
    const candidates = [];

    // Direct match
    const directPath = join(cwd, `${packageName}.csproj`);
    if (existsSync(directPath)) return directPath;

    // Search cwd for any .csproj
    try {
      const files = readdirSync(cwd).filter(f => f.endsWith(".csproj"));
      for (const f of files) candidates.push(join(cwd, f));
    } catch { /* ignore */ }

    // Search src/ directory
    const srcDir = join(cwd, "src");
    if (existsSync(srcDir)) {
      try {
        for (const dir of readdirSync(srcDir, { withFileTypes: true })) {
          if (dir.isDirectory()) {
            const subPath = join(srcDir, dir.name);
            const subFiles = readdirSync(subPath).filter(f => f.endsWith(".csproj"));
            for (const f of subFiles) candidates.push(join(subPath, f));
          }
        }
      } catch { /* ignore */ }
    }

    // Prefer a csproj whose name matches the package name
    const match = candidates.find(p => {
      const name = p.split(/[\\/]/).pop().replace(".csproj", "");
      return name.toLowerCase() === packageName.toLowerCase() ||
             name.toLowerCase() === packageName.split(".").pop().toLowerCase();
    });

    return match ?? candidates[0] ?? null;
  }

  /** Find csproj remotely by checking common paths. */
  async #findCsprojRemote(entry) {
    try {
      // List repo root for .csproj files
      // The jq pattern "\\\\.csproj$" produces the literal string \\.csproj$ after
      // shell/JS escaping: JS "\\\\" → two backslashes → shell sees \\, jq sees \\.
      // We include `truncated` in the output object so we can warn when GitHub
      // has silently omitted files from a large repo's recursive tree.
      const raw = execFileSync(
        "gh", ["api", `repos/${entry.repo}/git/trees/HEAD?recursive=1`, "--jq", '{truncated: .truncated, paths: [.tree[].path | select(test("\\\\.csproj$"))]}'],
        { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
      );
      const treeResponse = JSON.parse(raw);
      // GitHub truncates recursive tree responses for large repos — warn if so.
      if (treeResponse?.truncated) {
        process.stderr.write(`  Warning: git tree response for ${entry.repo} was truncated — some .csproj files may be missed.\n`);
      }
      const paths = treeResponse?.paths ?? [];
      if (paths.length === 0) return null;

      // Prefer one matching the package name
      const match = paths.find(p => {
        const name = p.split("/").pop().replace(".csproj", "");
        return name.toLowerCase() === entry.name.toLowerCase() ||
               name.toLowerCase() === entry.name.split(".").pop().toLowerCase();
      });
      return match ?? paths[0];
    } catch (e) {
      // 404 / empty repo / no HEAD — genuine not-found, return silently.
      const msg = e.message ?? "";
      const is404 = msg.includes("404") || msg.includes("Not Found") ||
                    msg.includes("Git Repository is empty") || msg.includes("no such branch");
      if (!is404) {
        process.stderr.write(`  nuget-csproj: unexpected error finding .csproj in ${entry.repo}: ${msg}\n`);
      }
      return null;
    }
  }

  /** Check which metadata elements are missing. */
  #analyzeCsproj(content) {
    const missing = [];
    if (!content.includes("<PackageProjectUrl>")) missing.push("PackageProjectUrl");
    if (!content.includes("<RepositoryUrl>")) missing.push("RepositoryUrl");
    return missing;
  }

  /**
   * Escape XML special characters to prevent injection when interpolating
   * user-controlled values (e.g. entry.repo) into XML content.
   */
  #escapeXml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /** Insert missing metadata into the first <PropertyGroup>. */
  #fixCsproj(content, repoUrl, projectUrl) {
    let result = content;

    const safeRepoUrl = this.#escapeXml(repoUrl);
    const safeProjectUrl = this.#escapeXml(projectUrl);

    // Find the first <PropertyGroup> closing or a line before </PropertyGroup>
    const pgMatch = result.match(/<PropertyGroup[^>]*>/);
    if (!pgMatch) return result; // Can't safely edit without PropertyGroup

    const insertIdx = result.indexOf(pgMatch[0]) + pgMatch[0].length;

    const additions = [];
    if (!result.includes("<PackageProjectUrl>")) {
      additions.push(`    <PackageProjectUrl>${safeProjectUrl}</PackageProjectUrl>`);
    }
    if (!result.includes("<RepositoryUrl>")) {
      additions.push(`    <RepositoryUrl>${safeRepoUrl}.git</RepositoryUrl>`);
    }

    if (additions.length === 0) return result;

    // Extra leading newline separates inserted metadata from existing content for readability.
    const insertBlock = "\n\n" + additions.join("\n");
    result = result.slice(0, insertIdx) + insertBlock + result.slice(insertIdx);

    return result;
  }
}
