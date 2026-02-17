/**
 * `mcpt-publishing plan` — dry-run publish plan (stub).
 *
 * Future: compares manifest → registries → generates a publish plan
 * showing what would be published, skipped, or blocked.
 */

import { EXIT } from "../cli/exit-codes.mjs";

export const helpText = `
mcpt-publishing plan — Generate a dry-run publish plan.

Usage:
  mcpt-publishing plan [flags]

Flags:
  --json        Output as JSON
  --help        Show this help

Status: Not yet implemented. Coming in a future release.
`.trim();

/**
 * Execute the plan command (stub).
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  if (flags.json) {
    process.stdout.write(JSON.stringify({ status: "not_implemented", message: "Plan command is not yet implemented." }) + "\n");
  } else {
    process.stderr.write("Plan command is not yet implemented.\n");
    process.stderr.write("This will generate a dry-run publish plan in a future release.\n");
  }
  return EXIT.SUCCESS;
}
