#!/usr/bin/env node
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

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

console.log("\n=== Version Consistency ===\n");

// 1. Semver format
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
  const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  assert(changelog.includes(pkg.version), `CHANGELOG.md mentions version ${pkg.version}`);
}

// 4. CLI --version matches package.json
{
  const out = execFileSync("node", [join(ROOT, "bin", "mcpt-publishing.mjs"), "--version"], {
    encoding: "utf8",
    cwd: ROOT,
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
