/**
 * CLI router — zero-dependency subcommand parser and dispatcher.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GLOBAL_HELP } from "./help.mjs";
import { EXIT } from "./exit-codes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Lazy-loaded command map. Keys are subcommand names. */
const COMMANDS = {
  audit:            () => import("../commands/audit.mjs"),
  fix:              () => import("../commands/fix.mjs"),
  init:             () => import("../commands/init.mjs"),
  publish:          () => import("../commands/publish.mjs"),
  providers:        () => import("../commands/providers.mjs"),
  weekly:           () => import("../commands/weekly.mjs"),
  assets:           () => import("../commands/assets.mjs"),
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
  const flags = Object.create(null);
  flags._positionals = [];
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
      const SHORT = { h: "help", v: "version", j: "json", n: "dry-run", t: "target", r: "repo", c: "config" };
      const key = arg[1];
      const expanded = SHORT[key];
      if (expanded) {
        // Value-taking short flags: -t, -r, -c accept the next argument as their value
        const VALUE_FLAGS = new Set(["target", "repo", "config"]);
        if (VALUE_FLAGS.has(expanded)) {
          const next = args[i + 1];
          if (next && !next.startsWith("-")) {
            flags[expanded] = next;
            i++;
          } else {
            flags[expanded] = true;
          }
        } else {
          flags[expanded] = true;
        }
      } else {
        flags._positionals.push(arg);
      }
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
  // If a valid subcommand precedes --help, fall through to per-command help dispatch below.
  if (args.includes("--help") || args.includes("-h")) {
    if (!subcommand || !COMMANDS[subcommand]) {
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
    // Exit 1 for unknown commands (usage error); 0 for bare invocation or flag-only args
    process.exit(!subcommand || subcommand.startsWith("-") ? 0 : 1);
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
    process.stderr.write(`Error: ${e?.message ?? String(e)}\n`);
    if (e?.stack) process.stderr.write(`${e.stack}\n`);
    process.exit(EXIT.UNEXPECTED_ERROR);
  }
}
