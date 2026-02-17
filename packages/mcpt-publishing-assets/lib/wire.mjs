/**
 * Wire — update README.md and .csproj to reference generated assets.
 *
 * Ensures:
 *   README: logo image URL points to stable absolute URL
 *   .csproj: <PackageIcon> references the generated icon
 *
 * @param {object} opts
 * @param {string} opts.repo    — "owner/name"
 * @param {string} opts.outDir  — directory containing icon.png/logo.png
 * @param {string} [opts.mode]  — "npm" | "nuget" | "all" (default: "all")
 * @param {string} [opts.cwd]   — working directory (default: process.cwd())
 * @returns {Promise<{ changes: Array<{ file: string, field: string, before: string, after: string }> }>}
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export async function wire(opts) {
  const { repo, outDir, mode = "all", cwd = process.cwd() } = opts;
  const changes = [];

  const doNpm = mode === "all" || mode === "npm";
  const doNuget = mode === "all" || mode === "nuget";

  // Wire README logo URL
  if (doNpm) {
    const readmePath = join(cwd, "README.md");
    if (existsSync(readmePath)) {
      const content = readFileSync(readmePath, "utf8");
      const logoUrl = `https://raw.githubusercontent.com/${repo}/main/logo.png`;

      // Check if there's already a logo reference — update it
      const logoPattern = /!\[.*?\]\(.*?logo\.png.*?\)/;
      if (logoPattern.test(content)) {
        const newContent = content.replace(
          logoPattern,
          `![${repo.split("/").pop()} logo](${logoUrl})`
        );
        if (newContent !== content) {
          writeFileSync(readmePath, newContent);
          changes.push({
            file: readmePath,
            field: "README logo URL",
            before: content.match(logoPattern)?.[0] ?? "(pattern)",
            after: `![${repo.split("/").pop()} logo](${logoUrl})`,
          });
        }
      }
    }
  }

  // Wire .csproj PackageIcon
  if (doNuget) {
    const csprojPath = findCsproj(cwd);
    if (csprojPath) {
      const content = readFileSync(csprojPath, "utf8");
      let newContent = content;

      // Add PackageIcon if missing
      if (!content.includes("<PackageIcon>")) {
        const pgMatch = newContent.match(/<PropertyGroup[^>]*>/);
        if (pgMatch) {
          const idx = newContent.indexOf(pgMatch[0]) + pgMatch[0].length;
          newContent =
            newContent.slice(0, idx) +
            "\n    <PackageIcon>icon.png</PackageIcon>" +
            newContent.slice(idx);
        }
      }

      // Add PackageReadmeFile if missing
      if (!content.includes("<PackageReadmeFile>")) {
        const pgMatch = newContent.match(/<PropertyGroup[^>]*>/);
        if (pgMatch) {
          const idx = newContent.indexOf(pgMatch[0]) + pgMatch[0].length;
          newContent =
            newContent.slice(0, idx) +
            "\n    <PackageReadmeFile>README.md</PackageReadmeFile>" +
            newContent.slice(idx);
        }
      }

      if (newContent !== content) {
        writeFileSync(csprojPath, newContent);
        changes.push({
          file: csprojPath,
          field: "PackageIcon + PackageReadmeFile",
          before: "(missing)",
          after: "(added)",
        });
      }
    }
  }

  return { changes };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function findCsproj(cwd) {
  try {
    const files = readdirSync(cwd).filter((f) => f.endsWith(".csproj"));
    if (files.length > 0) return join(cwd, files[0]);
  } catch {
    /* ignore */
  }

  // Check src/ one level deep
  const srcDir = join(cwd, "src");
  if (existsSync(srcDir)) {
    try {
      for (const dir of readdirSync(srcDir, { withFileTypes: true })) {
        if (dir.isDirectory()) {
          const subFiles = readdirSync(join(srcDir, dir.name)).filter((f) =>
            f.endsWith(".csproj")
          );
          if (subFiles.length > 0) return join(srcDir, dir.name, subFiles[0]);
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}
