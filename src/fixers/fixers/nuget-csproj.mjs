/**
 * Fixer: nuget-csproj — adds/fixes metadata fields in .csproj.
 * Matches audit finding code: "missing-project-url"
 *
 * Handles: PackageProjectUrl, RepositoryUrl, PackageIcon, PackageReadmeFile
 * Uses string manipulation (no XML parser, zero deps).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

      const needs = this.#analyzeCsproj(remote.content, repoUrl, projectUrl);
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

    const content = readFileSync(csprojPath, "utf8");
    const needs = this.#analyzeCsproj(content, repoUrl, projectUrl);
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

    const content = readFileSync(csprojPath, "utf8");
    const repoUrl = `https://github.com/${entry.repo}`;
    const projectUrl = `${repoUrl}#readme`;
    const newContent = this.#fixCsproj(content, repoUrl, projectUrl);

    if (newContent === content) return { changed: false };

    writeFileSync(csprojPath, newContent);
    return { changed: true, before: "(missing metadata)", after: "(metadata added)", file: csprojPath };
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
    const { execSync } = await import("node:child_process");
    try {
      // List repo root for .csproj files
      const raw = execSync(
        `gh api "repos/${entry.repo}/git/trees/HEAD?recursive=1" --jq "[.tree[].path | select(test(\"\\\\.csproj$\"))]"`,
        { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }
      );
      const paths = JSON.parse(raw);
      if (paths.length === 0) return null;

      // Prefer one matching the package name
      const match = paths.find(p => {
        const name = p.split("/").pop().replace(".csproj", "");
        return name.toLowerCase() === entry.name.toLowerCase() ||
               name.toLowerCase() === entry.name.split(".").pop().toLowerCase();
      });
      return match ?? paths[0];
    } catch {
      return null;
    }
  }

  /** Check which metadata elements are missing. */
  #analyzeCsproj(content, repoUrl, projectUrl) {
    const missing = [];
    if (!content.includes("<PackageProjectUrl>")) missing.push("PackageProjectUrl");
    if (!content.includes("<RepositoryUrl>")) missing.push("RepositoryUrl");
    return missing;
  }

  /** Insert missing metadata into the first <PropertyGroup>. */
  #fixCsproj(content, repoUrl, projectUrl) {
    let result = content;

    // Find the first <PropertyGroup> closing or a line before </PropertyGroup>
    const pgMatch = result.match(/<PropertyGroup[^>]*>/);
    if (!pgMatch) return result; // Can't safely edit without PropertyGroup

    const insertIdx = result.indexOf(pgMatch[0]) + pgMatch[0].length;

    const additions = [];
    if (!result.includes("<PackageProjectUrl>")) {
      additions.push(`    <PackageProjectUrl>${projectUrl}</PackageProjectUrl>`);
    }
    if (!result.includes("<RepositoryUrl>")) {
      additions.push(`    <RepositoryUrl>${repoUrl}.git</RepositoryUrl>`);
    }

    if (additions.length === 0) return result;

    const insertBlock = "\n" + additions.join("\n");
    result = result.slice(0, insertIdx) + insertBlock + result.slice(insertIdx);

    return result;
  }
}
