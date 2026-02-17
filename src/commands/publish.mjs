/**
 * `mcpt-publishing publish` — publish packages to registries with receipts.
 *
 * Loads config → reads manifest → filters by --repo/--target → pre-flight
 * credential check → executes publishes → writes receipts → updates index.
 *
 * Exit codes:
 *   0 — all publishes succeeded (or no packages matched)
 *   4 — missing credentials
 *   5 — one or more publishes failed
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../config/loader.mjs";
import { updatePublishEntry } from "../receipts/index-writer.mjs";
import { EXIT } from "../cli/exit-codes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const helpText = `
mcpt-publishing publish — Publish packages to registries and generate receipts.

Usage:
  mcpt-publishing publish [flags]

Flags:
  --repo <owner/name>   Filter to packages from this repo
  --target <registry>   Filter to a specific registry (npm, nuget)
  --cwd <path>          Working directory for the repo (default: cwd)
  --dry-run             Do everything except the actual registry push
  --json                Output results as JSON
  --help                Show this help

Exit codes:
  0   All publishes succeeded
  4   Missing credentials (NPM_TOKEN or NUGET_API_KEY)
  5   One or more publishes failed

Examples:
  mcpt-publishing publish --target npm --dry-run
  mcpt-publishing publish --repo mcp-tool-shop-org/mcpt --target npm
  mcpt-publishing publish --repo mcp-tool-shop-org/soundboard-maui --target nuget --cwd /path/to/repo
`.trim();

/** Required env vars per provider. */
const CRED_MAP = {
  npm: "NPM_TOKEN",
  nuget: "NUGET_API_KEY",
  pypi: "PYPI_TOKEN",
  ghcr: "GITHUB_TOKEN",
};

/**
 * Execute the publish command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  // 1. Load config
  const config = flags.config
    ? loadConfig(dirname(flags.config))
    : loadConfig();

  // 2. Read manifest
  const manifestPath = join(config.profilesDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`Error: Manifest not found at ${manifestPath}\n`);
    process.stderr.write(`Run 'mcpt-publishing init' to scaffold the project.\n`);
    return EXIT.CONFIG_ERROR;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // 3. Load providers
  const registryPath = join(__dirname, "..", "..", "scripts", "lib", "registry.mjs");
  const registryUrl = pathToFileURL(registryPath).href;
  const { loadProviders, matchProviders } = await import(registryUrl);
  const providers = await loadProviders();

  // 4. Build task list from manifest
  const tasks = [];
  for (const [ecosystem, packages] of Object.entries(manifest)) {
    if (!Array.isArray(packages)) continue;
    for (const pkg of packages) {
      const entry = { ...pkg, ecosystem };

      // Apply filters
      if (flags.repo && entry.repo !== flags.repo) continue;
      if (flags.target && ecosystem !== flags.target) continue;
      if (entry.deprecated) continue;

      // Find ecosystem providers (skip github context loader)
      const matched = matchProviders(providers, entry).filter(p => p.name !== "github");
      for (const provider of matched) {
        tasks.push({ entry, provider });
      }
    }
  }

  if (tasks.length === 0) {
    if (flags.json) {
      process.stdout.write(JSON.stringify({ results: [], failures: 0, message: "No packages matched filters" }) + "\n");
    } else {
      process.stderr.write("No packages matched the given filters.\n");
      if (flags.repo) process.stderr.write(`  --repo: ${flags.repo}\n`);
      if (flags.target) process.stderr.write(`  --target: ${flags.target}\n`);
    }
    return EXIT.SUCCESS;
  }

  // 5. Pre-flight credential check
  const neededCreds = new Set();
  for (const { provider } of tasks) {
    const envVar = CRED_MAP[provider.name];
    if (envVar && !process.env[envVar]) {
      neededCreds.add(envVar);
    }
  }

  if (neededCreds.size > 0 && !flags["dry-run"]) {
    for (const envVar of neededCreds) {
      process.stderr.write(`Error: ${envVar} environment variable is not set.\n`);
    }
    return EXIT.MISSING_CREDENTIALS;
  }

  // 6. Execute publishes sequentially
  const cwd = flags.cwd ? resolve(flags.cwd) : process.cwd();
  const dryRun = !!flags["dry-run"];
  const results = [];
  let failures = 0;

  // Import receipt writer and shell utils
  const receiptWriterPath = join(__dirname, "..", "..", "scripts", "lib", "receipt-writer.mjs");
  const shellPath = join(__dirname, "..", "..", "scripts", "lib", "shell.mjs");
  const { write: writeReceipt } = await import(pathToFileURL(receiptWriterPath).href);
  const { getCommitSha } = await import(pathToFileURL(shellPath).href);

  for (const { entry, provider } of tasks) {
    const label = `${entry.name} → ${provider.name}`;
    process.stderr.write(`\nPublishing ${label}${dryRun ? " (dry-run)" : ""}...\n`);

    try {
      const result = await provider.publish(entry, { dryRun, cwd });

      if (!result.success) {
        process.stderr.write(`  FAIL: ${result.error}\n`);
        failures++;
        results.push({ name: entry.name, target: provider.name, success: false, error: result.error });
        continue;
      }

      process.stderr.write(`  OK: ${entry.name}@${result.version}\n`);

      // Write receipt (skip in dry-run)
      if (!dryRun) {
        try {
          const commitSha = getCommitSha(cwd);
          const receiptData = provider.receipt({
            ...entry,
            version: result.version,
            commitSha,
            artifacts: result.artifacts,
          });

          const receiptFile = writeReceipt(receiptData);
          updatePublishEntry(config.receiptsDir, receiptData);
          process.stderr.write(`  Receipt: ${receiptFile}\n`);

          // GitHub glue: attach to release (opt-in)
          if (config.github?.attachReceipts) {
            try {
              const gluePath = join(__dirname, "..", "..", "scripts", "lib", "github-glue.mjs");
              const { attachReceiptToRelease } = await import(pathToFileURL(gluePath).href);
              const tagName = `v${result.version}`;
              attachReceiptToRelease(entry.repo, tagName, receiptFile);
              process.stderr.write(`  Attached to release ${tagName}\n`);
            } catch (e) {
              // GitHub glue failures are non-fatal
              process.stderr.write(`  Warning: GitHub glue failed: ${e.message}\n`);
            }
          }
        } catch (e) {
          process.stderr.write(`  Warning: Receipt write failed: ${e.message}\n`);
          // Receipt failure doesn't fail the publish — the package IS published
        }
      }

      results.push({
        name: entry.name,
        target: provider.name,
        success: true,
        version: result.version,
        artifacts: result.artifacts,
        dryRun,
      });
    } catch (e) {
      process.stderr.write(`  ERROR: ${e.message}\n`);
      failures++;
      results.push({ name: entry.name, target: provider.name, success: false, error: e.message });
    }
  }

  // 7. Summary
  const succeeded = results.filter(r => r.success).length;

  if (flags.json) {
    process.stdout.write(JSON.stringify({ results, succeeded, failures, dryRun }, null, 2) + "\n");
  } else {
    process.stderr.write(`\nDone. ${succeeded} succeeded, ${failures} failed.${dryRun ? " (dry-run)" : ""}\n`);
  }

  return failures > 0 ? EXIT.PUBLISH_FAILURE : EXIT.SUCCESS;
}
