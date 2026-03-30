/**
 * `mcpt-publishing plan` — REMOVED.
 *
 * Use `mcpt-publishing fix --dry-run` instead.
 */

export const helpText = `
mcpt-publishing plan — removed

Use fix --dry-run instead:
  mcpt-publishing fix --dry-run       Preview metadata fixes
  mcpt-publishing weekly --dry-run    Preview full audit + fix pipeline

Run 'mcpt-publishing fix --help' for details.
`.trim();

/**
 * Execute the plan command (removed stub).
 * @param {object} flags - Parsed CLI flags
 * @returns {number} Exit code
 */
export async function execute(_flags) {
  process.stderr.write("plan is removed — use fix --dry-run\n");
  return 1;
}
