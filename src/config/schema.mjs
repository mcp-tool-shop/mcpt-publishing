/**
 * Lightweight config validation (zero dependencies).
 *
 * Validates publishing.config.json structure and types.
 * Throws on invalid input with a clear message.
 */

const KNOWN_KEYS = new Set([
  "$schema", "profilesDir", "receiptsDir", "reportsDir",
  "github", "enabledProviders",
]);

const KNOWN_GITHUB_KEYS = new Set([
  "updateIssue", "attachReceipts",
]);

/**
 * Validate a parsed config object.
 * @param {object} config
 * @throws {Error} on invalid config
 */
export function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Config must be a JSON object");
  }

  // Check for unknown top-level keys
  for (const key of Object.keys(config)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`Unknown config key: "${key}"`);
    }
  }

  // String path fields
  for (const field of ["profilesDir", "receiptsDir", "reportsDir"]) {
    if (field in config && typeof config[field] !== "string") {
      throw new Error(`Config "${field}" must be a string`);
    }
  }

  // github section
  if ("github" in config) {
    if (typeof config.github !== "object" || Array.isArray(config.github)) {
      throw new Error('Config "github" must be an object');
    }
    for (const key of Object.keys(config.github)) {
      if (!KNOWN_GITHUB_KEYS.has(key)) {
        throw new Error(`Unknown config github key: "${key}"`);
      }
    }
    if ("updateIssue" in config.github && typeof config.github.updateIssue !== "boolean") {
      throw new Error('Config "github.updateIssue" must be a boolean');
    }
    if ("attachReceipts" in config.github && typeof config.github.attachReceipts !== "boolean") {
      throw new Error('Config "github.attachReceipts" must be a boolean');
    }
  }

  // enabledProviders
  if ("enabledProviders" in config) {
    if (!Array.isArray(config.enabledProviders)) {
      throw new Error('Config "enabledProviders" must be an array');
    }
    for (const p of config.enabledProviders) {
      if (typeof p !== "string") {
        throw new Error('Config "enabledProviders" entries must be strings');
      }
    }
  }
}
