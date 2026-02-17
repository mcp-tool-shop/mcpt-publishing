/**
 * `mcpt-publishing init` — scaffold publishing config and starter directories.
 *
 * Creates:
 *   - publishing.config.json  (with $schema pointer)
 *   - profiles/manifest.json  (empty skeleton)
 *   - receipts/               (empty dir)
 *   - reports/                (empty dir)
 *
 * Supports --dry-run to preview what would be created without writing.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EXIT } from "../cli/exit-codes.mjs";

export const helpText = `
mcpt-publishing init — Scaffold publishing config in current directory.

Usage:
  mcpt-publishing init [flags]

Flags:
  --force       Overwrite existing publishing.config.json
  --dry-run     Preview what would be created (no writes)
  --json        Output result as JSON
  --help        Show this help

Creates:
  publishing.config.json   Configuration file with schema pointer
  profiles/manifest.json   Empty package inventory
  receipts/                Receipt output directory
  reports/                 Report output directory
`.trim();

const STARTER_CONFIG = {
  $schema: "https://github.com/mcp-tool-shop/mcpt-publishing/schemas/publishing-config.schema.json",
  profilesDir: "profiles",
  receiptsDir: "receipts",
  reportsDir: "reports",
  github: {
    updateIssue: true,
    attachReceipts: true,
  },
  enabledProviders: [],
};

const STARTER_MANIFEST = {
  $comment: "Machine-readable inventory of all published packages. Source of truth for audit.",
  npm: [],
  nuget: [],
  pypi: [],
  ghcr: [],
};

/**
 * Execute the init command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  const cwd = process.cwd();
  const configPath = join(cwd, "publishing.config.json");
  const dryRun = !!flags["dry-run"];
  const created = [];

  // Config file
  if (existsSync(configPath) && !flags.force) {
    if (flags.json) {
      process.stdout.write(JSON.stringify({ error: "publishing.config.json already exists. Use --force to overwrite." }) + "\n");
    } else {
      process.stderr.write(`publishing.config.json already exists. Use --force to overwrite.\n`);
    }
    return EXIT.CONFIG_ERROR;
  }

  if (!dryRun) {
    writeFileSync(configPath, JSON.stringify(STARTER_CONFIG, null, 2) + "\n");
  }
  created.push("publishing.config.json");

  // Profiles directory + manifest
  const profilesDir = join(cwd, "profiles");
  if (!dryRun) {
    mkdirSync(profilesDir, { recursive: true });
  }
  const manifestPath = join(profilesDir, "manifest.json");
  if (!existsSync(manifestPath) || flags.force) {
    if (!dryRun) {
      writeFileSync(manifestPath, JSON.stringify(STARTER_MANIFEST, null, 2) + "\n");
    }
    created.push("profiles/manifest.json");
  }

  // Receipts directory
  if (!dryRun) {
    mkdirSync(join(cwd, "receipts"), { recursive: true });
  }
  created.push("receipts/");

  // Reports directory
  if (!dryRun) {
    mkdirSync(join(cwd, "reports"), { recursive: true });
  }
  created.push("reports/");

  if (flags.json) {
    process.stdout.write(JSON.stringify({ created, path: cwd, dryRun }) + "\n");
  } else {
    const prefix = dryRun ? "[dry-run] Would initialize" : "Initialized";
    process.stderr.write(`${prefix} mcpt-publishing in ${cwd}\n`);
    for (const f of created) {
      process.stderr.write(`  ${dryRun ? "[would create]" : "+"} ${f}\n`);
    }
    if (!dryRun) {
      process.stderr.write(`\nNext: edit profiles/manifest.json to add your packages, then run:\n`);
      process.stderr.write(`  mcpt-publishing audit\n`);
    }
  }

  return EXIT.SUCCESS;
}
