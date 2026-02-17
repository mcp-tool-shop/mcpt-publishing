/**
 * `mcpt-publishing init` — scaffold publishing config and starter directories.
 *
 * Creates:
 *   - publishing.config.json  (with $schema pointer)
 *   - profiles/manifest.json  (empty skeleton)
 *   - receipts/               (empty dir)
 *   - reports/                (empty dir)
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

  writeFileSync(configPath, JSON.stringify(STARTER_CONFIG, null, 2) + "\n");
  created.push("publishing.config.json");

  // Profiles directory + manifest
  const profilesDir = join(cwd, "profiles");
  mkdirSync(profilesDir, { recursive: true });
  const manifestPath = join(profilesDir, "manifest.json");
  if (!existsSync(manifestPath) || flags.force) {
    writeFileSync(manifestPath, JSON.stringify(STARTER_MANIFEST, null, 2) + "\n");
    created.push("profiles/manifest.json");
  }

  // Receipts directory
  const receiptsDir = join(cwd, "receipts");
  mkdirSync(receiptsDir, { recursive: true });
  created.push("receipts/");

  // Reports directory
  const reportsDir = join(cwd, "reports");
  mkdirSync(reportsDir, { recursive: true });
  created.push("reports/");

  if (flags.json) {
    process.stdout.write(JSON.stringify({ created, path: cwd }) + "\n");
  } else {
    process.stderr.write(`Initialized mcpt-publishing in ${cwd}\n`);
    for (const f of created) {
      process.stderr.write(`  + ${f}\n`);
    }
    process.stderr.write(`\nNext: edit profiles/manifest.json to add your packages, then run:\n`);
    process.stderr.write(`  mcpt-publishing audit\n`);
  }

  return EXIT.SUCCESS;
}
