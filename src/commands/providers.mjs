/**
 * `mcpt-publishing providers` — list registered providers and their status.
 *
 * Loads providers from scripts/lib/registry.mjs, optionally filters by
 * enabledProviders config, and prints a summary table.
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../config/loader.mjs";
import { EXIT } from "../cli/exit-codes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const helpText = `
mcpt-publishing providers — List registered providers.

Usage:
  mcpt-publishing providers [flags]

Flags:
  --json        Output as JSON array
  --config      Explicit path to publishing.config.json
  --help        Show this help

Output:
  Shows each provider name, supported ecosystems, and enabled/disabled status.
`.trim();

/**
 * Execute the providers command.
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  const config = flags.config
    ? loadConfig(dirname(flags.config))
    : loadConfig();

  // Import provider registry from scripts/lib
  const registryPath = join(__dirname, "..", "..", "scripts", "lib", "registry.mjs");
  const registryUrl = pathToFileURL(registryPath).href;
  const { loadProviders } = await import(registryUrl);

  const providers = await loadProviders();
  const enabled = config.enabledProviders ?? [];
  const allEnabled = enabled.length === 0; // empty = all enabled

  const rows = providers.map(p => {
    const isEnabled = allEnabled || enabled.includes(p.name);
    return {
      name: p.name,
      ecosystem: p.ecosystem ?? p.name,
      enabled: isEnabled,
      status: isEnabled ? "active" : "disabled",
    };
  });

  if (flags.json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return EXIT.SUCCESS;
  }

  // Human-readable table
  process.stdout.write("\n");
  process.stdout.write("  Provider     Ecosystem    Status\n");
  process.stdout.write("  ─────────    ─────────    ──────\n");
  for (const row of rows) {
    const name = row.name.padEnd(12);
    const eco = row.ecosystem.padEnd(12);
    const status = row.enabled ? "active" : "disabled";
    process.stdout.write(`  ${name} ${eco} ${status}\n`);
  }
  process.stdout.write("\n");

  if (!allEnabled) {
    process.stdout.write(`  Filter: enabledProviders = [${enabled.join(", ")}]\n\n`);
  }

  return EXIT.SUCCESS;
}
