#!/usr/bin/env node
// NOTE: This file must be wired into npm test script. See FT-TST-001.
/**
 * Version consistency tests for mcpt-publishing.
 * Validates package metadata, CHANGELOG, and CLI alignment.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}`);
  }
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
} catch {
  assert(false, "package.json not found or not readable");
  process.exit(fail > 0 ? 1 : 0);
}

console.log("\n=== Version Consistency ===\n");

// 1. Semver format
// NOTE: Pre-release suffixes (e.g. -alpha.1, -rc.2) are intentionally rejected by this check.
// Published packages must use a clean release version (X.Y.Z only). Pre-release versions
// should not be shipped to the registry under the default tag.
{
  const semver = /^\d+\.\d+\.\d+$/;
  assert(semver.test(pkg.version), `package.json version "${pkg.version}" is valid semver`);
}

// 2. >= 1.0.0
{
  const major = parseInt(pkg.version.split(".")[0], 10);
  assert(major >= 1, `version ${pkg.version} is >= 1.0.0`);
}

// 3. CHANGELOG mentions current version
{
  let changelog;
  try {
    changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  } catch {
    assert(false, "CHANGELOG.md not found");
    changelog = null;
  }
  if (changelog !== null) {
    assert(changelog.includes(pkg.version), `CHANGELOG.md mentions version ${pkg.version}`);
  }
}

// 4. CLI --version matches package.json
{
  const out = execFileSync("node", [join(ROOT, "bin", "mcpt-publishing.mjs"), "--version"], {
    encoding: "utf8",
    cwd: ROOT,
    timeout: 10_000,
  }).trim();
  assert(out.includes(pkg.version), `CLI --version output "${out}" contains ${pkg.version}`);
}

// 5. Package uses @mcptoolshop scope
{
  assert(pkg.name.startsWith("@mcptoolshop/"), `package name "${pkg.name}" uses @mcptoolshop scope`);
}

// 6. bin entry exists
{
  assert(pkg.bin && Object.keys(pkg.bin).length > 0, "package.json has bin entry");
}

console.log(`\n${"=".repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${"=".repeat(50)}\n`);

process.exit(fail > 0 ? 1 : 0);
