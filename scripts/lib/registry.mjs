/**
 * Provider registry — auto-discovers and validates providers.
 *
 * Scans scripts/lib/providers/*.mjs, imports each default export,
 * and validates it extends Provider with required method overrides.
 */

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Provider } from "./provider.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROVIDERS_DIR = join(__dirname, "providers");

const REQUIRED_METHODS = ["detect", "audit"];

/**
 * Dynamically import all .mjs files from providers/ directory.
 * Each must export default a class extending Provider.
 * @returns {Promise<Provider[]>}
 */
export async function loadProviders() {
  const files = readdirSync(PROVIDERS_DIR).filter(f => f.endsWith(".mjs"));
  const providers = [];

  for (const file of files) {
    const filePath = join(PROVIDERS_DIR, file);
    const fileUrl = pathToFileURL(filePath).href;
    const mod = await import(fileUrl);
    const Ctor = mod.default;

    if (!Ctor || typeof Ctor !== "function") {
      throw new Error(`${file}: default export must be a class`);
    }

    // Verify it extends Provider
    if (!(Ctor.prototype instanceof Provider)) {
      throw new Error(`${file}: default export must extend Provider`);
    }

    const instance = new Ctor();

    // Validate required methods are overridden (not the base class stubs)
    for (const method of REQUIRED_METHODS) {
      if (instance[method] === Provider.prototype[method]) {
        throw new Error(`${file}: must override ${method}()`);
      }
    }

    providers.push(instance);
  }

  return providers;
}

/**
 * Given an entry, return the providers that claim it via detect().
 * @param {Provider[]} providers
 * @param {object} entry
 * @returns {Provider[]}
 */
export function matchProviders(providers, entry) {
  return providers.filter(p => p.detect(entry));
}
