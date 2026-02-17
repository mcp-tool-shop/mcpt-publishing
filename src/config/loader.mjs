/**
 * Config loader — discovers and parses publishing.config.json.
 *
 * Discovery order:
 *   1. PUBLISHING_CONFIG env var (explicit path)
 *   2. Walk up from startDir looking for publishing.config.json
 *   3. Fall back to defaults rooted at startDir
 *
 * All directory paths (profilesDir, receiptsDir, reportsDir) resolve
 * relative to the config file location, not process.cwd().
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { DEFAULTS } from "./defaults.mjs";
import { validateConfig } from "./schema.mjs";

const CONFIG_FILENAME = "publishing.config.json";

/**
 * Load config from the filesystem.
 * @param {string} [startDir=process.cwd()] - Directory to start searching from
 * @returns {object} Resolved config with absolute paths
 */
export function loadConfig(startDir = process.cwd()) {
  // 1. Env override takes priority
  const envPath = process.env.PUBLISHING_CONFIG;
  if (envPath) {
    const resolved = resolve(envPath);
    if (!existsSync(resolved)) {
      throw new Error(`PUBLISHING_CONFIG points to non-existent file: ${resolved}`);
    }
    return parseAndResolve(resolved);
  }

  // 2. Walk up from startDir
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return parseAndResolve(candidate);
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root reached
    dir = parent;
  }

  // 3. No config found — return defaults rooted at startDir
  const resolvedStart = resolve(startDir);
  return {
    ...DEFAULTS,
    github: { ...DEFAULTS.github },
    profilesDir: join(resolvedStart, DEFAULTS.profilesDir),
    receiptsDir: join(resolvedStart, DEFAULTS.receiptsDir),
    reportsDir: join(resolvedStart, DEFAULTS.reportsDir),
    _configDir: resolvedStart,
    _configFile: null,
  };
}

/**
 * Parse a config file and resolve all paths relative to its location.
 * @param {string} filePath - Absolute path to the config file
 * @returns {object}
 */
function parseAndResolve(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  validateConfig(raw);

  const configDir = dirname(filePath);

  return {
    ...DEFAULTS,
    ...raw,
    github: { ...DEFAULTS.github, ...raw.github },
    profilesDir: resolvePath(configDir, raw.profilesDir ?? DEFAULTS.profilesDir),
    receiptsDir: resolvePath(configDir, raw.receiptsDir ?? DEFAULTS.receiptsDir),
    reportsDir: resolvePath(configDir, raw.reportsDir ?? DEFAULTS.reportsDir),
    _configDir: configDir,
    _configFile: filePath,
  };
}

function resolvePath(base, p) {
  return isAbsolute(p) ? p : resolve(base, p);
}
