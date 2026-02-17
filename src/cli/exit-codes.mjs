/**
 * Named exit codes for CI-friendly CLI behavior.
 *
 *   0 — success
 *   1 — reserved for uncaught exceptions (Node default)
 *   2 — drift found (audit found RED-severity issues)
 *   3 — config or schema error
 *   4 — missing credentials for a requested operation
 *   5 — one or more publishes failed
 *   6 — one or more fixes failed to apply
 */
export const EXIT = {
  SUCCESS: 0,
  DRIFT_FOUND: 2,
  CONFIG_ERROR: 3,
  MISSING_CREDENTIALS: 4,
  PUBLISH_FAILURE: 5,
  FIX_FAILURE: 6,
};
