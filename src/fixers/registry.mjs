/**
 * Fixer registry — auto-discovers and validates fixer modules.
 *
 * Mirrors the pattern from scripts/lib/registry.mjs (provider auto-discovery).
 * Scans src/fixers/fixers/*.mjs, validates each extends Fixer, returns instances.
 */

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Fixer } from "./fixer.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXERS_DIR = join(__dirname, "fixers");

/**
 * Load all fixer modules from the fixers/ directory.
 * Skips files prefixed with `_` (helpers).
 *
 * @returns {Promise<Fixer[]>} Array of fixer instances
 */
export async function loadFixers() {
  const files = readdirSync(FIXERS_DIR)
    .filter(f => f.endsWith(".mjs") && !f.startsWith("_"))
    .sort();

  const fixers = [];

  for (const file of files) {
    const url = pathToFileURL(join(FIXERS_DIR, file)).href;
    const mod = await import(url);
    const FixerClass = mod.default;

    if (!FixerClass) {
      throw new Error(`Fixer module ${file} has no default export`);
    }

    const instance = new FixerClass();

    if (!(instance instanceof Fixer)) {
      throw new Error(`Fixer module ${file} does not extend Fixer`);
    }

    // Validate required overrides
    try {
      instance.code;
    } catch {
      throw new Error(`Fixer ${file} does not override 'code'`);
    }
    try {
      instance.target;
    } catch {
      throw new Error(`Fixer ${file} does not override 'target'`);
    }

    fixers.push(instance);
  }

  return fixers;
}

/**
 * Find fixers that can handle a given audit finding.
 *
 * @param {Fixer[]} fixers  - All loaded fixers
 * @param {object}  finding - { severity, code, msg }
 * @returns {Fixer[]} Matching fixers
 */
export function matchFixers(fixers, finding) {
  return fixers.filter(f => f.canFix(finding));
}
