/**
 * CLI router — zero-dependency subcommand parser and dispatcher.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GLOBAL_HELP } from "./help.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Lazy-loaded command map. Keys are subcommand names. */
const COMMANDS = {
  audit:            () => import("../commands/audit.mjs"),
  init:             () => import("../commands/init.mjs"),
  plan:             () => import("../commands/plan.mjs"),
  publish:          () => import("../commands/publish.mjs"),
  providers:        () => import("../commands/providers.mjs"),
  "verify-receipt": () => import("../commands/verify-receipt.mjs"),
};

/**
 * Parse CLI flags from an argv slice (after the subcommand).
 *
 *   --flag        → { flag: true }
 *   --key value   → { key: "value" }
 *   bare          → pushed to _positionals
 *
 * @param {string[]} args
 * @returns {object}
 */
export function parseFlags(args) {
  const flags = { _positionals: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      flags._positionals.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag aliases
      const SHORT = { h: "help", v: "version", j: "json" };
      const expanded = SHORT[arg[1]];
      if (expanded) flags[expanded] = true;
      else flags._positionals.push(arg);
    } else {
      flags._positionals.push(arg);
    }
  }
  return flags;
}

/**
 * Main entry point — parse argv and dispatch to the matching command.
 * @param {string[]} argv - process.argv
 */
export async function run(argv) {
  const args = argv.slice(2);
  const subcommand = args[0];

  // --help / -h at global level (before subcommand lookup)
  if (args.includes("--help") || args.includes("-h")) {
    // If a valid subcommand precedes --help, show per-command help
    if (subcommand && COMMANDS[subcommand]) {
      // handled below after flag parsing
    } else {
      process.stdout.write(GLOBAL_HELP + "\n");
      process.exit(0);
    }
  }

  // --version at global level
  if (args.includes("--version") || args.includes("-v")) {
    const pkgPath = join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    process.stdout.write(pkg.version + "\n");
    process.exit(0);
  }

  // No subcommand or unknown → global help
  if (!subcommand || !COMMANDS[subcommand]) {
    if (subcommand && !subcommand.startsWith("-") && !COMMANDS[subcommand]) {
      process.stderr.write(`Unknown command: ${subcommand}\n\n`);
    }
    process.stdout.write(GLOBAL_HELP + "\n");
    process.exit(!subcommand || subcommand.startsWith("-") ? 0 : 3);
  }

  // Parse flags after the subcommand
  const flags = parseFlags(args.slice(1));

  // Per-command help
  if (flags.help) {
    const mod = await COMMANDS[subcommand]();
    if (mod.helpText) {
      process.stdout.write(mod.helpText + "\n");
    } else {
      process.stdout.write(GLOBAL_HELP + "\n");
    }
    process.exit(0);
  }

  // Dispatch
  try {
    const mod = await COMMANDS[subcommand]();
    const exitCode = await mod.execute(flags);
    process.exit(exitCode ?? 0);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(3);
  }
}
