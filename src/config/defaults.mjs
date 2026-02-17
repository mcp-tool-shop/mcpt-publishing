/**
 * Default config values used when no publishing.config.json is found
 * or when fields are omitted from the config file.
 */
export const DEFAULTS = {
  profilesDir: "profiles",
  receiptsDir: "receipts",
  reportsDir: "reports",
  github: {
    updateIssue: true,
    attachReceipts: true,
  },
  enabledProviders: [], // empty = all providers enabled
};
