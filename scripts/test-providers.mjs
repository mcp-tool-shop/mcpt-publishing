#!/usr/bin/env node
/**
 * Smoke test for the provider system.
 *
 * Verifies:
 * 1. All providers load and pass validation
 * 2. Provider detection matches expected ecosystems
 * 3. Receipt validation accepts good data and rejects bad data
 * 4. Receipt immutability (double-write throws)
 *
 * Usage:
 *   node scripts/test-providers.mjs
 */

import { loadProviders, matchProviders } from "./lib/registry.mjs";
import { validate, write, read } from "./lib/receipt-writer.mjs";
import { existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// ─── Test 1: Provider Loading ────────────────────────────────────────────────

console.log("\n=== Provider Loading ===\n");

const providers = await loadProviders();
assert(providers.length >= 5, `Loaded ${providers.length} providers (expected >= 5)`);

const names = providers.map(p => p.name).sort();
console.log(`  Providers: ${names.join(", ")}`);

assert(names.includes("github"), "GitHub provider loaded");
assert(names.includes("npm"), "npm provider loaded");
assert(names.includes("nuget"), "NuGet provider loaded");
assert(names.includes("pypi"), "PyPI provider loaded");
assert(names.includes("ghcr"), "GHCR provider loaded");

// ─── Test 2: Provider Detection ──────────────────────────────────────────────

console.log("\n=== Provider Detection ===\n");

const npmEntry = { name: "@mcptoolshop/mcpt", repo: "mcp-tool-shop-org/mcpt", audience: "front-door", ecosystem: "npm" };
const npmMatch = matchProviders(providers, npmEntry).map(p => p.name).sort();
assert(npmMatch.includes("github"), `npm entry matches github provider`);
assert(npmMatch.includes("npm"), `npm entry matches npm provider`);
assert(!npmMatch.includes("nuget"), `npm entry does NOT match nuget provider`);
assert(!npmMatch.includes("pypi"), `npm entry does NOT match pypi provider`);

const nugetEntry = { name: "Soundboard.Client", repo: "mcp-tool-shop-org/soundboard-maui", audience: "front-door", ecosystem: "nuget" };
const nugetMatch = matchProviders(providers, nugetEntry).map(p => p.name).sort();
assert(nugetMatch.includes("github"), `nuget entry matches github provider`);
assert(nugetMatch.includes("nuget"), `nuget entry matches nuget provider`);
assert(!nugetMatch.includes("npm"), `nuget entry does NOT match npm provider`);

const pypiEntry = { name: "some-package", repo: "mcp-tool-shop-org/some-repo", audience: "front-door", ecosystem: "pypi" };
const pypiMatch = matchProviders(providers, pypiEntry).map(p => p.name).sort();
assert(pypiMatch.includes("github"), `pypi entry matches github provider`);
assert(pypiMatch.includes("pypi"), `pypi entry matches pypi provider`);
assert(!pypiMatch.includes("npm"), `pypi entry does NOT match npm provider`);

const ghcrEntry = { name: "some-image", repo: "mcp-tool-shop-org/some-repo", audience: "internal", ecosystem: "ghcr" };
const ghcrMatch = matchProviders(providers, ghcrEntry).map(p => p.name).sort();
assert(ghcrMatch.includes("github"), `ghcr entry matches github provider`);
assert(ghcrMatch.includes("ghcr"), `ghcr entry matches ghcr provider`);
assert(!ghcrMatch.includes("nuget"), `ghcr entry does NOT match nuget provider`);

// ─── Test 3: Receipt Validation ──────────────────────────────────────────────

console.log("\n=== Receipt Validation ===\n");

const goodReceipt = {
  schemaVersion: "1.0.0",
  repo: { owner: "mcp-tool-shop-org", name: "mcpt" },
  target: "npm",
  version: "1.0.1",
  packageName: "@mcptoolshop/mcpt",
  commitSha: "a".repeat(40),
  timestamp: new Date().toISOString(),
  artifacts: [{
    name: "mcpt-1.0.1.tgz",
    sha256: "b".repeat(64),
    size: 12345,
    url: "https://registry.npmjs.org/@mcptoolshop/mcpt/-/mcpt-1.0.1.tgz",
  }],
};

try {
  validate(goodReceipt);
  assert(true, "Valid receipt passes validation");
} catch (e) {
  assert(false, `Valid receipt passes validation — got: ${e.message}`);
}

// Bad: short commitSha
try {
  validate({ ...goodReceipt, commitSha: "abc" });
  assert(false, "Short commitSha should fail");
} catch {
  assert(true, "Short commitSha rejected");
}

// Bad: invalid target
try {
  validate({ ...goodReceipt, target: "docker" });
  assert(false, "Invalid target should fail");
} catch {
  assert(true, "Invalid target 'docker' rejected");
}

// Bad: missing field
try {
  const { version, ...noVersion } = goodReceipt;
  validate(noVersion);
  assert(false, "Missing version should fail");
} catch {
  assert(true, "Missing version rejected");
}

// Bad: invalid artifact sha256
try {
  validate({ ...goodReceipt, artifacts: [{ ...goodReceipt.artifacts[0], sha256: "xyz" }] });
  assert(false, "Invalid artifact sha256 should fail");
} catch {
  assert(true, "Invalid artifact sha256 rejected");
}

// ─── Test 4: Receipt Write + Immutability ────────────────────────────────────

console.log("\n=== Receipt Write + Immutability ===\n");

// Use a test receipt that writes to a unique location
const testReceipt = {
  ...goodReceipt,
  repo: { owner: "__test__", name: "smoke" },
  version: `test-${Date.now()}`,
};

const receiptDir = join(ROOT, "receipts", "publish", "__test__--smoke");

try {
  const path = write(testReceipt);
  assert(existsSync(path), `Receipt file created at ${path}`);

  // Read it back
  const loaded = read("__test__--smoke", "npm", testReceipt.version);
  assert(loaded !== null, "Receipt read back successfully");
  assert(loaded.version === testReceipt.version, "Receipt version matches");

  // Attempt double-write (should throw)
  try {
    write(testReceipt);
    assert(false, "Double-write should throw (immutability)");
  } catch (e) {
    assert(e.message.includes("immutable"), "Double-write throws immutability error");
  }
} finally {
  // Clean up test receipt
  if (existsSync(receiptDir)) {
    rmSync(receiptDir, { recursive: true });
  }
}

// ─── Shell Utilities ─────────────────────────────────────────────────────────

console.log("\n=== Shell Utilities ===\n");

const { exec: shellExec, hashFile, getCommitSha } = await import(
  pathToFileURL(join(__dirname, "lib", "shell.mjs")).href
);

// exec — success case
{
  const result = shellExec("node --version");
  assert(result.exitCode === 0, "exec: node --version exits 0");
  assert(result.stdout.startsWith("v"), "exec: stdout starts with 'v'");
}

// exec — failure case (no throw)
{
  const result = shellExec("node -e \"process.exit(42)\"");
  assert(result.exitCode === 42, "exec: non-zero exit captured without throwing");
}

// hashFile
{
  const testFile = join(__dirname, "..", "package.json");
  const { sha256, size } = hashFile(testFile);
  assert(typeof sha256 === "string" && sha256.length === 64, "hashFile: returns 64-char hex sha256");
  assert(typeof size === "number" && size > 0, "hashFile: returns positive size");
}

// getCommitSha
{
  const sha = getCommitSha();
  assert(/^[0-9a-f]{40}$/.test(sha), "getCommitSha: returns 40 lowercase hex chars");
}

// ─── Verify-Receipt Command ─────────────────────────────────────────────────

console.log("\n=== Verify-Receipt Command ===\n");

const { execute: verifyExecute } = await import(
  pathToFileURL(join(__dirname, "..", "src", "commands", "verify-receipt.mjs")).href
);

// Verify existing audit receipt
{
  const auditReceipt = join(__dirname, "..", "receipts", "audit", "2026-02-17.json");
  if (existsSync(auditReceipt)) {
    const code = await verifyExecute({ _positionals: [auditReceipt], json: true });
    assert(code === 0, "verify-receipt: audit receipt validates (exit 0)");
  } else {
    console.log("  SKIP  No audit receipt found to verify");
  }
}

// Verify missing file returns error
{
  const code = await verifyExecute({ _positionals: ["/nonexistent/receipt.json"], json: true });
  assert(code !== 0, "verify-receipt: missing file returns non-zero");
}

// Verify no path returns error
{
  const code = await verifyExecute({ _positionals: [] });
  assert(code !== 0, "verify-receipt: no path returns non-zero");
}

// ─── Exit Codes ─────────────────────────────────────────────────────────────

console.log("\n=== Exit Codes ===\n");

const { EXIT } = await import(
  pathToFileURL(join(__dirname, "..", "src", "cli", "exit-codes.mjs")).href
);

assert(EXIT.SUCCESS === 0, "EXIT.SUCCESS is 0");
assert(EXIT.DRIFT_FOUND === 2, "EXIT.DRIFT_FOUND is 2");
assert(EXIT.CONFIG_ERROR === 3, "EXIT.CONFIG_ERROR is 3");
assert(EXIT.MISSING_CREDENTIALS === 4, "EXIT.MISSING_CREDENTIALS is 4");
assert(EXIT.PUBLISH_FAILURE === 5, "EXIT.PUBLISH_FAILURE is 5");
assert(EXIT.FIX_FAILURE === 6, "EXIT.FIX_FAILURE is 6");

// ─── Test: Fixer Loading ────────────────────────────────────────────────────

console.log("\n=== Fixer Loading ===\n");

const { loadFixers, matchFixers } = await import(
  pathToFileURL(join(__dirname, "..", "src", "fixers", "registry.mjs")).href
);
const { Fixer } = await import(
  pathToFileURL(join(__dirname, "..", "src", "fixers", "fixer.mjs")).href
);

const fixers = await loadFixers();
assert(fixers.length === 7, `Loaded ${fixers.length} fixers (expected 7)`);

const fixerCodes = fixers.map(f => f.code).sort();
console.log(`  Fixers: ${fixerCodes.join(", ")}`);

assert(fixerCodes.includes("npm-repository"), "npm-repository fixer loaded");
assert(fixerCodes.includes("npm-homepage"), "npm-homepage fixer loaded");
assert(fixerCodes.includes("npm-bugs"), "npm-bugs fixer loaded");
assert(fixerCodes.includes("npm-keywords"), "npm-keywords fixer loaded");
assert(fixerCodes.includes("readme-header"), "readme-header fixer loaded");
assert(fixerCodes.includes("github-about"), "github-about fixer loaded");
assert(fixerCodes.includes("nuget-csproj"), "nuget-csproj fixer loaded");

// All extend Fixer
for (const f of fixers) {
  assert(f instanceof Fixer, `${f.code} extends Fixer`);
}

// All have valid target
const validTargets = new Set(["npm", "nuget", "readme", "github"]);
for (const f of fixers) {
  assert(validTargets.has(f.target), `${f.code} has valid target: ${f.target}`);
}

// ─── Test: Fixer Detection (canFix) ──────────────────────────────────────────

console.log("\n=== Fixer Detection ===\n");

{
  const repoUrlFinding = { code: "wrong-repo-url", severity: "RED" };
  const matched = matchFixers(fixers, repoUrlFinding);
  assert(matched.length === 1 && matched[0].code === "npm-repository", "wrong-repo-url → npm-repository");
}

{
  const homepageFinding = { code: "missing-homepage", severity: "GRAY" };
  const matched = matchFixers(fixers, homepageFinding);
  const codes = matched.map(m => m.code).sort();
  assert(codes.includes("npm-homepage"), "missing-homepage → npm-homepage");
  assert(codes.includes("github-about"), "missing-homepage → github-about");
}

{
  const bugsFinding = { code: "missing-bugs-url", severity: "GRAY" };
  const matched = matchFixers(fixers, bugsFinding);
  assert(matched.length === 1 && matched[0].code === "npm-bugs", "missing-bugs-url → npm-bugs");
}

{
  const keywordsFinding = { code: "missing-keywords", severity: "GRAY" };
  const matched = matchFixers(fixers, keywordsFinding);
  assert(matched.length === 1 && matched[0].code === "npm-keywords", "missing-keywords → npm-keywords");
}

{
  const readmeFinding = { code: "missing-readme", severity: "YELLOW" };
  const matched = matchFixers(fixers, readmeFinding);
  assert(matched.length === 1 && matched[0].code === "readme-header", "missing-readme → readme-header");
}

{
  const csprojFinding = { code: "missing-project-url", severity: "RED" };
  const matched = matchFixers(fixers, csprojFinding);
  assert(matched.length === 1 && matched[0].code === "nuget-csproj", "missing-project-url → nuget-csproj");
}

{
  const unknownFinding = { code: "some-random-code", severity: "RED" };
  const matched = matchFixers(fixers, unknownFinding);
  assert(matched.length === 0, "unknown finding code → no fixers matched");
}

// ─── Test: Fix Receipt Validation ────────────────────────────────────────────

console.log("\n=== Fix Receipt Validation ===\n");

{
  const goodFixReceipt = {
    schemaVersion: "1.0.0",
    type: "fix",
    timestamp: new Date().toISOString(),
    repo: "*",
    mode: "dry-run",
    changes: [{
      fixerCode: "npm-homepage",
      target: "npm",
      field: "homepage",
      before: "(missing)",
      after: "https://github.com/org/repo#readme",
    }],
    dryRun: true,
  };

  // Write a temp fix receipt to validate
  const { writeFileSync: wfs, mkdirSync: mks, rmSync: rms } = await import("node:fs");
  const fixReceiptDir = join(ROOT, "receipts", "fix");
  mks(fixReceiptDir, { recursive: true });
  const fixReceiptPath = join(fixReceiptDir, "__test-fix-receipt.json");
  wfs(fixReceiptPath, JSON.stringify(goodFixReceipt, null, 2));

  try {
    const code = await verifyExecute({ _positionals: [fixReceiptPath], json: true });
    assert(code === 0, "verify-receipt: valid fix receipt passes (exit 0)");
  } finally {
    try { rms(fixReceiptPath); } catch { /* ignore */ }
  }

  // Bad fix receipt: invalid mode
  const badFixReceipt = { ...goodFixReceipt, mode: "invalid-mode" };
  const badFixPath = join(fixReceiptDir, "__test-fix-receipt-bad.json");
  wfs(badFixPath, JSON.stringify(badFixReceipt, null, 2));

  try {
    const code = await verifyExecute({ _positionals: [badFixPath], json: true });
    assert(code !== 0, "verify-receipt: invalid fix mode rejected");
  } finally {
    try { rms(badFixPath); } catch { /* ignore */ }
  }

  // Bad fix receipt: missing changes array
  const noChanges = { ...goodFixReceipt };
  delete noChanges.changes;
  const noChangesPath = join(fixReceiptDir, "__test-fix-receipt-nochanges.json");
  wfs(noChangesPath, JSON.stringify(noChanges, null, 2));

  try {
    const code = await verifyExecute({ _positionals: [noChangesPath], json: true });
    assert(code !== 0, "verify-receipt: fix receipt without changes rejected");
  } finally {
    try { rms(noChangesPath); } catch { /* ignore */ }
  }
}

// ─── Test: npm Provider — New Findings ────────────────────────────────────────

console.log("\n=== npm Provider — New Findings ===\n");

{
  const npmProvider = providers.find(p => p.name === "npm");
  assert(npmProvider !== null, "npm provider found");

  // Test classify method indirectly — a package with no bugs/keywords should emit those findings
  // We'll just verify the method exists and the provider audits
  assert(typeof npmProvider.audit === "function", "npm provider has audit method");
  assert(typeof npmProvider.publish === "function", "npm provider has publish method");
  assert(typeof npmProvider.receipt === "function", "npm provider has receipt method");
}

// ─── Test: init --dry-run ────────────────────────────────────────────────────

console.log("\n=== init --dry-run ===\n");

{
  const { execute: initExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "init.mjs")).href
  );

  // Capture stderr to verify output
  const originalStderrWrite = process.stderr.write;
  let output = "";
  process.stderr.write = (chunk) => { output += chunk; return true; };

  const tmpDir = join(ROOT, "__test_init_dry_run_" + Date.now());

  try {
    const code = await initExecute({ "dry-run": true, cwd: tmpDir });
    assert(code === 0, "init --dry-run exits 0");
    assert(output.includes("[would create]") || output.includes("dry-run"), "init --dry-run reports what would be created");

    // Verify NO files were actually created
    assert(!existsSync(join(tmpDir, "publishing.config.json")), "init --dry-run: no publishing.config.json created");
    assert(!existsSync(join(tmpDir, "profiles")), "init --dry-run: no profiles/ created");
  } finally {
    process.stderr.write = originalStderrWrite;
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  }
}

// ─── Test: Plan Deprecation ──────────────────────────────────────────────────

console.log("\n=== Plan Deprecation ===\n");

{
  const { execute: planExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "plan.mjs")).href
  );

  const originalStderrWrite = process.stderr.write;
  let output = "";
  process.stderr.write = (chunk) => { output += chunk; return true; };

  try {
    const code = await planExecute({});
    assert(code === 0, "plan exits 0 (deprecated but not broken)");
    assert(output.includes("deprecated"), "plan shows deprecation message");
  } finally {
    process.stderr.write = originalStderrWrite;
  }

  // JSON mode
  const originalStdoutWrite = process.stdout.write;
  let jsonOutput = "";
  process.stdout.write = (chunk) => { jsonOutput += chunk; return true; };

  try {
    await planExecute({ json: true });
    const parsed = JSON.parse(jsonOutput);
    assert(parsed.status === "deprecated", "plan --json returns deprecated status");
    assert(parsed.replacement === "fix --dry-run", "plan --json includes replacement hint");
  } finally {
    process.stdout.write = originalStdoutWrite;
  }
}

// ─── Test: CLI Help Includes New Commands ────────────────────────────────────

console.log("\n=== CLI Help Includes New Commands ===\n");

{
  const { GLOBAL_HELP } = await import(
    pathToFileURL(join(__dirname, "..", "src", "cli", "help.mjs")).href
  );

  assert(GLOBAL_HELP.includes("fix"), "Global help includes 'fix' command");
  assert(GLOBAL_HELP.includes("weekly"), "Global help includes 'weekly' command");
  assert(GLOBAL_HELP.includes("assets"), "Global help includes 'assets' command");
  assert(GLOBAL_HELP.includes("deprecated"), "Global help marks plan as deprecated");
  assert(GLOBAL_HELP.includes("Golden path"), "Global help includes Golden path section");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${"=".repeat(50)}\n`);

process.exit(fail > 0 ? 1 : 0);
