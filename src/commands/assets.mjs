/**
 * `mcpt-publishing assets` — logo/icon generation and wiring.
 *
 * Delegates to the @mcptoolshop/mcpt-publishing-assets plugin.
 * If the plugin is not installed, shows an install hint and exits cleanly.
 *
 * Subcommands:
 *   doctor   — verify sharp is installed and working
 *   logo     — generate icon.png + logo.png from a source image
 *   wire     — wire generated assets into README / .csproj
 */

import { resolve } from "node:path";
import { loadPlugin, installHint } from "../plugins/loader.mjs";

export const helpText = `
mcpt-publishing assets — Logo, icon, and image asset management.

Usage:
  mcpt-publishing assets <subcommand> [flags]

Subcommands:
  doctor                         Check that sharp is installed and working
  logo --input <path> [--out <dir>]   Generate icon.png + logo.png
  wire --repo <owner/name> [--mode <npm|nuget|all>]  Wire assets into project files

Flags:
  --input <path>     Source image for logo generation
  --out <dir>        Output directory (default: ./assets)
  --repo <owner/name>  Target repo (required for wire)
  --mode <mode>      Wire mode: npm, nuget, or all (default: all)
  --cwd <path>       Working directory (default: cwd)
  --json             Output results as JSON
  --help             Show this help

Requires:
  npm i -D @mcptoolshop/mcpt-publishing-assets

Examples:
  mcpt-publishing assets doctor
  mcpt-publishing assets logo --input logo-source.png --out ./assets
  mcpt-publishing assets wire --repo mcp-tool-shop-org/mcpt --mode npm
`.trim();

/**
 * Execute the assets command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  const plugin = await loadPlugin("assets");

  if (!plugin) {
    process.stderr.write("Assets plugin is not installed.\n\n");
    process.stderr.write(`Install it with:\n  ${installHint("assets")}\n\n`);
    process.stderr.write("The assets plugin provides logo/icon generation using sharp.\n");
    return 0;
  }

  const subcommand = flags._positionals?.[0];

  if (!subcommand) {
    // No subcommand — show status
    const result = await plugin.doctor();
    if (result.ok) {
      process.stdout.write(`Assets plugin: OK (sharp v${result.sharpVersion})\n`);
      process.stdout.write(`\nSubcommands: doctor, logo, wire\n`);
      process.stdout.write(`Run 'mcpt-publishing assets --help' for details.\n`);
    } else {
      process.stderr.write(`Assets plugin: ERROR\n`);
      for (const err of result.errors) {
        process.stderr.write(`  - ${err}\n`);
      }
      return 3;
    }
    return 0;
  }

  switch (subcommand) {
    case "doctor":
      return await runDoctor(plugin, flags);
    case "logo":
      return await runLogo(plugin, flags);
    case "wire":
      return await runWire(plugin, flags);
    default:
      process.stderr.write(`Unknown assets subcommand: ${subcommand}\n`);
      process.stderr.write(`Available: doctor, logo, wire\n`);
      return 3;
  }
}

// ─── Subcommand handlers ─────────────────────────────────────────────────────

async function runDoctor(plugin, flags) {
  const result = await plugin.doctor();

  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else if (result.ok) {
    process.stdout.write(`sharp: OK (v${result.sharpVersion})\n`);
    process.stdout.write(`All checks passed.\n`);
  } else {
    process.stderr.write(`sharp: FAILED\n`);
    for (const err of result.errors) {
      process.stderr.write(`  - ${err}\n`);
    }
  }

  return result.ok ? 0 : 3;
}

async function runLogo(plugin, flags) {
  const input = flags.input;
  if (!input) {
    process.stderr.write("Error: --input <path> is required for logo generation.\n");
    return 3;
  }

  const outDir = flags.out ? resolve(flags.out) : resolve("assets");

  try {
    const result = await plugin.logo({ input: resolve(input), outDir });

    if (flags.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      process.stdout.write(`Generated:\n`);
      process.stdout.write(`  icon.png  ${result.icon.size} bytes  sha256:${result.icon.sha256.slice(0, 12)}...\n`);
      process.stdout.write(`  logo.png  ${result.logo.size} bytes  sha256:${result.logo.sha256.slice(0, 12)}...\n`);
      process.stdout.write(`\nOutput: ${outDir}\n`);
    }
    return 0;
  } catch (e) {
    process.stderr.write(`Error generating logos: ${e.message}\n`);
    return 3;
  }
}

async function runWire(plugin, flags) {
  const repo = flags.repo;
  if (!repo) {
    process.stderr.write("Error: --repo <owner/name> is required for wire.\n");
    return 3;
  }

  const cwd = flags.cwd ? resolve(flags.cwd) : process.cwd();
  const outDir = flags.out ? resolve(flags.out) : resolve("assets");
  const mode = flags.mode ?? "all";

  try {
    const result = await plugin.wire({ repo, outDir, mode, cwd });

    if (flags.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else if (result.changes.length === 0) {
      process.stdout.write("No wiring changes needed.\n");
    } else {
      process.stdout.write(`Wired ${result.changes.length} change(s):\n`);
      for (const c of result.changes) {
        process.stdout.write(`  ${c.field} in ${c.file}\n`);
      }
    }
    return 0;
  } catch (e) {
    process.stderr.write(`Error wiring assets: ${e.message}\n`);
    return 3;
  }
}
