/**
 * Plugin loader — discovers and loads optional plugin packages.
 *
 * Pattern: known plugin names → npm package names.
 * If the package is installed, import and return it.
 * If not, return null (caller shows install hint).
 *
 * ## Plugin Extension Contract
 *
 * ### KNOWN_PLUGINS registry
 * Maps short plugin names (used in CLI flags and internal calls) to their npm
 * package names. Currently registered plugins:
 *
 *   - "assets" → "@mcptoolshop/mcpt-publishing-assets"
 *     Adds asset-publishing support: generates and uploads screenshots, logos,
 *     and other binary artefacts as part of the publish pipeline.
 *
 * ### How to add a new plugin
 * 1. Add an entry to KNOWN_PLUGINS: `pluginName: "@scope/mcpt-publishing-<name>"`.
 * 2. The plugin npm package must export:
 *      - `name` {string} — matches the KNOWN_PLUGINS key
 *      - `execute(flags, config)` {Function} — async entry point
 *      - (optional) `helpText` {string} — shown by `mcpt-publishing help`
 * 3. Plugins are optional — if the package is not installed, `loadPlugin()`
 *    returns null and callers display the `installHint()` message.
 * 4. Plugins must not modify manifest.json directly; they write receipts using
 *    the shared receipt-writer contract.
 */

const KNOWN_PLUGINS = {
  assets: "@mcptoolshop/mcpt-publishing-assets",
};

/**
 * Attempt to load a known plugin.
 * @param {string} name — "assets"
 * @returns {Promise<object|null>} The plugin module, or null if not installed.
 */
export async function loadPlugin(name) {
  const pkgName = KNOWN_PLUGINS[name];
  if (!pkgName) return null;

  try {
    return await import(pkgName);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND" || e.code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw e; // Re-throw unexpected errors
  }
}

/**
 * Get the install command hint for a plugin.
 * @param {string} name — "assets"
 * @returns {string}
 */
export function installHint(name) {
  const pkgName = KNOWN_PLUGINS[name];
  return pkgName ? `npm i -D ${pkgName}` : `Unknown plugin: ${name}`;
}

/**
 * List all known plugins.
 * @returns {Array<{ name: string, package: string }>}
 */
export function listPlugins() {
  return Object.entries(KNOWN_PLUGINS).map(([name, pkg]) => ({ name, package: pkg }));
}
