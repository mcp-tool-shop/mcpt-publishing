/**
 * `mcpt-publishing plan` — DEPRECATED.
 *
 * Use `mcpt-publishing fix --dry-run` instead.
 */

import { EXIT } from "../cli/exit-codes.mjs";

export const helpText = `
mcpt-publishing plan — DEPRECATED

The plan command has been replaced by:
  mcpt-publishing fix --dry-run       Preview metadata fixes
  mcpt-publishing weekly --dry-run    Preview full audit → fix pipeline

Run 'mcpt-publishing fix --help' for details.
`.trim();

/**
 * Execute the plan command (deprecated stub).
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(flags) {
  if (flags.json) {
    process.stdout.write(JSON.stringify({
      status: "deprecated",
      message: "The plan command is deprecated. Use `mcpt-publishing fix --dry-run` instead.",
      replacement: "fix --dry-run",
    }) + "\n");
  } else {
    process.stderr.write("⚠ The plan command is deprecated.\n\n");
    process.stderr.write("Use one of these instead:\n");
    process.stderr.write("  mcpt-publishing fix --dry-run       Preview metadata fixes\n");
    process.stderr.write("  mcpt-publishing weekly --dry-run    Preview full audit → fix pipeline\n");
  }
  return EXIT.SUCCESS;
}
