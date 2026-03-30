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
 *
 * NOTE — Migration path (PB-TST-013):
 *   This file is intentionally a flat sequential script rather than a node:test suite.
 *   The custom assert() helper and sequential execution model were chosen for simplicity
 *   and minimal dependencies during early development.
 *
 *   Planned migration: convert to node:test (built-in test runner, Node 18+) so that
 *   tests run in parallel, gain proper TAP/spec reporters, and align with the rest of
 *   the test suite (tests/*.test.mjs already uses node:test). Track as a dedicated
 *   refactor ticket — do NOT convert piecemeal, as the sequential ordering of some
 *   sections (e.g. process.chdir + stderr monkey-patch) requires careful restructuring
 *   using t.before()/t.after() hooks.
 */

import { loadProviders, matchProviders } from "./lib/registry.mjs";
import { validate, write, read } from "./lib/receipt-writer.mjs";
import { existsSync, readFileSync, rmSync, mkdtempSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let pass = 0;
let fail = 0;

function assert(condition, label, actual) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}${actual !== undefined ? ' — actual: ' + JSON.stringify(actual) : ''}`);
  }
}

// ─── Version Consistency ─────────────────────────────────────────────────────

console.log("\n=== Version Consistency ===\n");

// Load package.json with guard — a missing or unreadable package.json is a hard failure
let pkg;
try {
  pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
} catch {
  // Record failure and skip remaining version checks — cannot proceed without pkg metadata
  assert(false, "package.json not found or not readable");
  pkg = null;
}

if (pkg !== null) {
  // Semver format — pre-release suffixes intentionally rejected; published packages must
  // use a clean X.Y.Z version, never -alpha/-rc under the default tag.
  const semver = /^\d+\.\d+\.\d+$/;
  assert(semver.test(pkg.version), `package.json version "${pkg.version}" is valid semver`);

  // Must be >= 1.0.0
  const major = parseInt(pkg.version.split(".")[0], 10);
  assert(major >= 1, `version ${pkg.version} is >= 1.0.0`);

  // CHANGELOG must mention the current version
  {
    let changelog = null;
    try {
      changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    } catch {
      assert(false, "CHANGELOG.md not found");
    }
    if (changelog !== null) {
      assert(changelog.includes(pkg.version), `CHANGELOG.md mentions version ${pkg.version}`);
    }
  }

  // CLI --version must match package.json
  {
    try {
      const out = execFileSync(
        "node",
        [join(ROOT, "bin", "mcpt-publishing.mjs"), "--version"],
        { encoding: "utf8", cwd: ROOT }
      ).trim();
      assert(out.includes(pkg.version), `CLI --version output "${out}" contains ${pkg.version}`);
    } catch (e) {
      assert(false, `CLI --version threw: ${e.message}`);
    }
  }

  // Package scope
  assert(pkg.name.startsWith("@mcptoolshop/"), `package name "${pkg.name}" uses @mcptoolshop scope`);

  // bin entry exists
  assert(pkg.bin && Object.keys(pkg.bin).length > 0, "package.json has bin entry");
}

// ─── Test 1: Provider Loading ────────────────────────────────────────────────

console.log("\n=== Provider Loading ===\n");

let providers;
try {
  providers = await loadProviders();
} catch (e) {
  console.error(`\nFATAL: loadProviders() failed — check that scripts/lib/providers/*.mjs exist and are valid ES modules.\nError: ${e.message}`);
  process.exit(1);
}

// Derive expected count from actual files on disk — avoids magic numbers drifting out of sync
const providerFiles = readdirSync(join(__dirname, "lib", "providers")).filter(f => f.endsWith(".mjs"));
const expectedProviderCount = providerFiles.length; // e.g. ghcr.mjs, github.mjs, npm.mjs, nuget.mjs, pypi.mjs
assert(
  providers.length === expectedProviderCount,
  `Loaded ${providers.length} providers (expected ${expectedProviderCount} matching files in scripts/lib/providers/)`,
  providers.length
);

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

// Deterministic sha256 fixture — derived from a stable input so tests are reproducible
// without relying on real artifact files.
const TEST_SHA256 = createHash("sha256").update("test").digest("hex");

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
    sha256: TEST_SHA256,
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
    assert(e.message.startsWith("Receipt already exists (immutable):"), "Double-write throws immutability error with correct prefix");
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
  assert(result.exitCode === 42, "exec: non-zero exit captured without throwing", result.exitCode);
}

// hashFile
{
  const testFile = join(__dirname, "..", "package.json");
  const { sha256, size } = hashFile(testFile);
  assert(typeof sha256 === "string" && sha256.length === 64, "hashFile: returns 64-char hex sha256");
  assert(typeof size === "number" && size > 0, "hashFile: returns positive size");

  // Determinism: two calls on the same file must return the same sha256 (F-TST-009)
  const { sha256: sha256b } = hashFile(testFile);
  assert(sha256 === sha256b, "hashFile: deterministic — two calls return identical sha256");
}

// getCommitSha — wrap in try/catch; this repo may not be in a git context (F-TST-010)
{
  try {
    const sha = getCommitSha();
    assert(/^[0-9a-f]{40}$/.test(sha), "getCommitSha: returns 40 lowercase hex chars");
  } catch (e) {
    // Not in a git repo is an expected failure path — verify it's a well-formed error
    assert(typeof e.message === "string" && e.message.length > 0, "getCommitSha: non-git context throws well-formed error");
  }
}

// ─── Verify-Receipt Command ─────────────────────────────────────────────────

console.log("\n=== Verify-Receipt Command ===\n");

const { execute: verifyExecute } = await import(
  pathToFileURL(join(__dirname, "..", "src", "commands", "verify-receipt.mjs")).href
);

// Verify a deterministic audit receipt fixture written to a temp path
{
  const { mkdtempSync: mkdtempVR, writeFileSync: wfsVR, rmSync: rmsVR } = await import("node:fs");
  const { tmpdir: tmpdirVR } = await import("node:os");
  const auditFixtureDir = mkdtempVR(join(tmpdirVR(), "mcpt-verify-audit-"));
  const auditFixturePath = join(auditFixtureDir, "audit-fixture.json");
  const auditFixture = {
    schemaVersion: "1.0.0",
    type: "audit",
    timestamp: new Date().toISOString(),
    counts: { RED: 0, YELLOW: 1, GRAY: 2 },
    totalPackages: 3,
    findings: [],
  };
  wfsVR(auditFixturePath, JSON.stringify(auditFixture, null, 2));
  try {
    const code = await verifyExecute({ _positionals: [auditFixturePath], json: true });
    assert(code === 0, "verify-receipt: deterministic audit fixture validates (exit 0)");
  } finally {
    try { rmsVR(auditFixtureDir, { recursive: true }); } catch { /* ignore */ }
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

const fixerCodes = fixers.map(f => f.code).sort();
console.log(`  Fixers: ${fixerCodes.join(", ")}`);

// Expected fixer codes — one entry per non-helper file in src/fixers/fixers/*.mjs.
// When adding a new fixer, add its code here AND add a corresponding assert below.
// Codes (sorted): github-about, npm-bugs, npm-homepage, npm-keywords, npm-repository,
//                 nuget-csproj, readme-header
// Helper files prefixed with _ (e.g. _constants.mjs, _npm-helpers.mjs) are excluded.
const { readdirSync: readdirFixers } = await import("node:fs");
const fixerFiles = readdirFixers(join(ROOT, "src", "fixers", "fixers"))
  .filter(f => f.endsWith(".mjs") && !f.startsWith("_"));
const expectedFixerCount = fixerFiles.length;
assert(
  fixers.length === expectedFixerCount,
  `Loaded ${fixers.length} fixers (expected ${expectedFixerCount} non-helper files in src/fixers/fixers/)`,
  fixers.length
);

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
  const npmHomepageFinding = { code: "missing-homepage", severity: "GRAY", ecosystem: "npm" };
  const npmMatched = matchFixers(fixers, npmHomepageFinding);
  const npmCodes = npmMatched.map(m => m.code).sort();
  assert(npmCodes.includes("npm-homepage"), "missing-homepage (npm) → npm-homepage");
  assert(!npmCodes.includes("github-about"), "missing-homepage (npm) should NOT match github-about");

  const ghHomepageFinding = { code: "missing-homepage", severity: "GRAY", ecosystem: "github" };
  const ghMatched = matchFixers(fixers, ghHomepageFinding);
  const ghCodes = ghMatched.map(m => m.code).sort();
  assert(ghCodes.includes("github-about"), "missing-homepage (github) → github-about");
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

  // Write temp fix receipts to os.tmpdir() to avoid polluting the production receipts/fix/ dir
  const { writeFileSync: wfs, mkdtempSync: mkdtempFix, rmSync: rms } = await import("node:fs");
  const { tmpdir: tmpdirFix } = await import("node:os");
  const fixTmpDir = mkdtempFix(join(tmpdirFix(), "mcpt-fix-receipt-test-"));
  const fixReceiptPath = join(fixTmpDir, "test-fix-receipt.json");
  wfs(fixReceiptPath, JSON.stringify(goodFixReceipt, null, 2));

  try {
    const code = await verifyExecute({ _positionals: [fixReceiptPath], json: true });
    assert(code === 0, "verify-receipt: valid fix receipt passes (exit 0)");
  } finally {
    try { rms(fixReceiptPath); } catch { /* ignore */ }
  }

  // Bad fix receipt: invalid mode
  const badFixReceipt = { ...goodFixReceipt, mode: "invalid-mode" };
  const badFixPath = join(fixTmpDir, "test-fix-receipt-bad.json");
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
  const noChangesPath = join(fixTmpDir, "test-fix-receipt-nochanges.json");
  wfs(noChangesPath, JSON.stringify(noChanges, null, 2));

  try {
    const code = await verifyExecute({ _positionals: [noChangesPath], json: true });
    assert(code !== 0, "verify-receipt: fix receipt without changes rejected");
  } finally {
    try { rms(noChangesPath); } catch { /* ignore */ }
    try { rms(fixTmpDir, { recursive: true }); } catch { /* ignore */ }
  }
}

// ─── Test: npm Provider — New Findings (F-TST-008) ───────────────────────────

console.log("\n=== npm Provider — New Findings ===\n");

{
  // Import NpmProvider class directly and instantiate to test pure methods
  const NpmProvider = (await import(
    pathToFileURL(join(__dirname, "lib", "providers", "npm.mjs")).href
  )).default;

  const npmProvider = new NpmProvider();

  assert(npmProvider.name === "npm", "NpmProvider: name is 'npm'");
  assert(typeof npmProvider.audit === "function", "NpmProvider: has audit method");
  assert(typeof npmProvider.publish === "function", "NpmProvider: has publish method");
  assert(typeof npmProvider.receipt === "function", "NpmProvider: has receipt method");

  // detect() is a pure method — verify it matches npm ecosystem entries only
  assert(npmProvider.detect({ ecosystem: "npm" }) === true, "NpmProvider.detect: returns true for npm ecosystem");
  assert(npmProvider.detect({ ecosystem: "nuget" }) === false, "NpmProvider.detect: returns false for nuget ecosystem");
  assert(npmProvider.detect({ ecosystem: "pypi" }) === false, "NpmProvider.detect: returns false for pypi ecosystem");

  // receipt() is a pure method — verify it shapes a publish result into a receipt
  {
    const mockResult = {
      repo: "mcp-tool-shop-org/test-pkg",
      name: "@mcptoolshop/test-pkg",
      version: "1.2.3",
      commitSha: "a".repeat(40),
      artifacts: [{ name: "test-pkg-1.2.3.tgz", sha256: TEST_SHA256, size: 1000, url: "https://npm.test" }],
    };
    const receipt = npmProvider.receipt(mockResult);
    assert(receipt.schemaVersion === "1.0.0", "NpmProvider.receipt: schemaVersion is 1.0.0");
    assert(receipt.target === "npm", "NpmProvider.receipt: target is npm");
    assert(receipt.repo.owner === "mcp-tool-shop-org", "NpmProvider.receipt: repo.owner extracted correctly");
    assert(receipt.repo.name === "test-pkg", "NpmProvider.receipt: repo.name extracted correctly");
    assert(receipt.version === "1.2.3", "NpmProvider.receipt: version preserved");
    assert(receipt.packageName === "@mcptoolshop/test-pkg", "NpmProvider.receipt: packageName preserved");
    assert(Array.isArray(receipt.artifacts), "NpmProvider.receipt: artifacts is array");
  }

  // publish() — null meta path: no package.json in cwd returns error without throwing
  {
    const result = await npmProvider.publish(
      { name: "@mcptoolshop/no-exist", repo: "mcp-tool-shop-org/no-exist", ecosystem: "npm" },
      { cwd: join(ROOT, "__nonexistent_dir__"), dryRun: true }
    );
    assert(result.success === false, "NpmProvider.publish: missing package.json returns success=false");
    assert(typeof result.error === "string" && result.error.length > 0, "NpmProvider.publish: missing package.json has error message");
  }
}

// ─── Test: init --dry-run ────────────────────────────────────────────────────

console.log("\n=== init --dry-run ===\n");

{
  const { execute: initExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "init.mjs")).href
  );

  // NOTE: These tests are strictly sequential — process.stderr.write is monkey-patched
  // for capture and MUST be restored in the finally block before any subsequent test runs.
  // Never run these sections concurrently.
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let output = "";
  process.stderr.write = (chunk) => { output += chunk; return true; };

  const tmpDir = mkdtempSync(join(tmpdir(), 'mcpt-init-dry-run-'));

  try {
    const code = await initExecute({ "dry-run": true, cwd: tmpDir });
    assert(code === 0, "init --dry-run exits 0");
    assert(output.includes("[would create]") || output.includes("dry-run"), "init --dry-run reports what would be created");

    // Verify NO files were actually created
    assert(!existsSync(join(tmpDir, "publishing.config.json")), "init --dry-run: no publishing.config.json created");
    assert(!existsSync(join(tmpDir, "profiles")), "init --dry-run: no profiles/ created");
  } finally {
    // Always restore — must be unconditional so subsequent tests get real stderr
    process.stderr.write = originalStderrWrite;
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  }
}

// ─── Test: Plan Deprecation ──────────────────────────────────────────────────

console.log("\n=== Plan Removed ===\n");

{
  const { execute: planExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "plan.mjs")).href
  );

  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let output = "";
  process.stderr.write = (chunk) => { output += chunk; return true; };

  try {
    const code = await planExecute({});
    assert(code === 1, "plan exits 1 (removed)");
    assert(output.includes("removed") || output.includes("fix --dry-run"), "plan shows removal message");
  } finally {
    process.stderr.write = originalStderrWrite;
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
  assert(!GLOBAL_HELP.includes("plan"), "Global help does not include removed plan command");
  assert(GLOBAL_HELP.includes("Golden path"), "Global help includes Golden path section");
}

// ─── Test: Receipt Validation — Unknown schemaVersion (F-TST-002) ────────────

console.log("\n=== Receipt Validation — Unknown schemaVersion ===\n");

{
  try {
    validate({ ...goodReceipt, schemaVersion: "9.9.9" });
    assert(false, "Unknown schemaVersion '9.9.9' should fail validation");
  } catch (e) {
    assert(true, "Unknown schemaVersion '9.9.9' rejected by validate()");
  }
}

// ─── Test: Receipt Validation — Empty artifacts array (F-TST-003) ────────────

console.log("\n=== Receipt Validation — Empty artifacts array ===\n");

{
  try {
    validate({ ...goodReceipt, artifacts: [] });
    // NOTE: If we get here, validate() does not currently reject empty artifacts.
    // This is a known gap — audit-fixers domain owns the fix.
    assert(false, "Empty artifacts array should fail validation");
  } catch (e) {
    assert(true, "Empty artifacts array rejected by validate()");
  }
}

// ─── Test: init real write path (F-TST-004) ──────────────────────────────────

console.log("\n=== init — real write path ===\n");

{
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { execute: initExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "init.mjs")).href
  );

  const tmpDir = mkdtempSync(join(tmpdir(), "mcpt-init-test-"));
  // process.chdir() is required here because the init command uses process.cwd() to
  // determine where to write publishing.config.json and profiles/. There is no `cwd`
  // option accepted by initExecute() in the real-write path, so we must repoint the
  // process working directory to the temp dir.
  //
  // Restoration contract: originalCwd MUST be restored in the finally block,
  // unconditionally, before any subsequent test section runs. Failing to restore leaves
  // the process in the temp dir, which is deleted at the end of the block, causing all
  // subsequent relative-path resolution (and process.cwd()-dependent code) to break.
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const code = await initExecute({});
    assert(code === 0, "init (real write) exits 0");
    assert(existsSync(join(tmpDir, "publishing.config.json")), "init creates publishing.config.json");
    assert(existsSync(join(tmpDir, "profiles", "manifest.json")), "init creates profiles/manifest.json");
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  }

  // Already-exists guard: run init again in a new tmpDir that already has a config.
  // process.chdir() is used again for the same reason as above — init reads process.cwd()
  // to locate the config file. Restoration contract: originalCwd restored unconditionally
  // in finally so the test runner cwd stays stable for all sections that follow.
  const tmpDir2 = mkdtempSync(join(tmpdir(), "mcpt-init-exists-test-"));
  const { writeFileSync: wfs2 } = await import("node:fs");
  wfs2(join(tmpDir2, "publishing.config.json"), "{}");

  try {
    process.chdir(tmpDir2);
    const code2 = await initExecute({});
    assert(code2 !== 0, "init returns non-zero when publishing.config.json already exists");
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir2, { recursive: true });
  }
}

// ─── Test: parseFlags (F-TST-005) ────────────────────────────────────────────

console.log("\n=== parseFlags ===\n");

{
  const { parseFlags } = await import(
    pathToFileURL(join(__dirname, "..", "src", "cli", "router.mjs")).href
  );

  // Boolean flag
  {
    const flags = parseFlags(["--json"]);
    assert(flags.json === true, "parseFlags: --json sets json to true");
  }

  // Key-value flag
  {
    const flags = parseFlags(["--config", "/some/path/config.json"]);
    assert(flags.config === "/some/path/config.json", "parseFlags: --config <path> captures value");
  }

  // Positionals
  {
    const flags = parseFlags(["some-command", "another-arg"]);
    assert(flags._positionals.length === 2, "parseFlags: bare args go to _positionals");
    assert(flags._positionals[0] === "some-command", "parseFlags: first positional correct");
    assert(flags._positionals[1] === "another-arg", "parseFlags: second positional correct");
  }

  // -- separator
  {
    const flags = parseFlags(["--json", "--", "--not-a-flag", "pos"]);
    assert(flags.json === true, "parseFlags: -- separator: flags before -- parsed");
    assert(flags._positionals.includes("--not-a-flag"), "parseFlags: args after -- are positionals");
    assert(flags._positionals.includes("pos"), "parseFlags: args after -- include bare arg");
  }

  // Short aliases -h, -v, -j
  {
    const flags = parseFlags(["-h"]);
    assert(flags.help === true, "parseFlags: -h expands to help");
  }
  {
    const flags = parseFlags(["-v"]);
    assert(flags.version === true, "parseFlags: -v expands to version");
  }
  {
    const flags = parseFlags(["-j"]);
    assert(flags.json === true, "parseFlags: -j expands to json");
  }

  // Mixed flags and positionals
  // Note: --dry-run consumes the next non-flag arg as its value (key=value parsing).
  // Positionals that aren't consumed as values must appear before flags or after --.
  {
    const flags = parseFlags(["my-target", "--dry-run", "--config", "a.json"]);
    assert(flags["dry-run"] === true, "parseFlags: mixed: boolean flag parsed when positional is first");
    assert(flags.config === "a.json", "parseFlags: mixed: key-value flag parsed");
    assert(flags._positionals.includes("my-target"), "parseFlags: mixed: positional captured when placed before flags");
  }
}

// ─── Test: loadConfig (F-TST-006) ────────────────────────────────────────────

console.log("\n=== loadConfig ===\n");

{
  const { loadConfig } = await import(
    pathToFileURL(join(__dirname, "..", "src", "config", "loader.mjs")).href
  );
  const { mkdtempSync: mkdtemp2 } = await import("node:fs");
  const { tmpdir: tmpdir2 } = await import("node:os");
  const { writeFileSync: wfsTmp } = await import("node:fs");

  // Env-var override: PUBLISHING_CONFIG points to a valid config file
  {
    const tmpDir = mkdtemp2(join(tmpdir2(), "mcpt-cfg-env-"));
    const cfgPath = join(tmpDir, "publishing.config.json");
    wfsTmp(cfgPath, JSON.stringify({ profilesDir: "profiles" }) + "\n");
    const prevEnv = process.env.PUBLISHING_CONFIG;
    try {
      process.env.PUBLISHING_CONFIG = cfgPath;
      const cfg = loadConfig("/some/unrelated/dir");
      assert(cfg._configFile === cfgPath, "loadConfig: PUBLISHING_CONFIG env var overrides walk-up");
    } finally {
      if (prevEnv === undefined) delete process.env.PUBLISHING_CONFIG;
      else process.env.PUBLISHING_CONFIG = prevEnv;
      rmSync(tmpDir, { recursive: true });
    }
  }

  // Walk-up discovery: config exists in a parent directory
  {
    const tmpDir = mkdtemp2(join(tmpdir2(), "mcpt-cfg-walk-"));
    const cfgPath = join(tmpDir, "publishing.config.json");
    wfsTmp(cfgPath, JSON.stringify({ profilesDir: "profiles" }) + "\n");
    const subDir = join(tmpDir, "packages", "my-pkg");
    const { mkdirSync: mks2 } = await import("node:fs");
    mks2(subDir, { recursive: true });
    // Make sure PUBLISHING_CONFIG is unset
    const prevEnv = process.env.PUBLISHING_CONFIG;
    delete process.env.PUBLISHING_CONFIG;
    try {
      const cfg = loadConfig(subDir);
      assert(cfg._configFile === cfgPath, "loadConfig: walks up to find config in parent dir");
    } finally {
      if (prevEnv !== undefined) process.env.PUBLISHING_CONFIG = prevEnv;
      rmSync(tmpDir, { recursive: true });
    }
  }

  // Fallback to defaults: no config anywhere in the tree (use system temp)
  {
    const isolatedDir = mkdtemp2(join(tmpdir2(), "mcpt-cfg-default-"));
    const prevEnv = process.env.PUBLISHING_CONFIG;
    delete process.env.PUBLISHING_CONFIG;
    try {
      const cfg = loadConfig(isolatedDir);
      assert(cfg._configFile === null, "loadConfig: fallback sets _configFile to null");
      assert(typeof cfg.profilesDir === "string" && cfg.profilesDir.length > 0, "loadConfig: fallback provides profilesDir default");
    } finally {
      if (prevEnv !== undefined) process.env.PUBLISHING_CONFIG = prevEnv;
      rmSync(isolatedDir, { recursive: true });
    }
  }
}

// ─── Test: validateConfig (F-TST-007) ────────────────────────────────────────

console.log("\n=== validateConfig ===\n");

{
  const { validateConfig } = await import(
    pathToFileURL(join(__dirname, "..", "src", "config", "schema.mjs")).href
  );

  // Valid minimal config (empty object is valid)
  {
    try {
      validateConfig({});
      assert(true, "validateConfig: empty object is valid minimal config");
    } catch (e) {
      assert(false, `validateConfig: empty object should be valid — got: ${e.message}`);
    }
  }

  // Valid config with all known keys
  {
    try {
      validateConfig({ profilesDir: "profiles", receiptsDir: "receipts", reportsDir: "reports", enabledProviders: ["npm"] });
      assert(true, "validateConfig: config with known keys is valid");
    } catch (e) {
      assert(false, `validateConfig: config with known keys should be valid — got: ${e.message}`);
    }
  }

  // Unknown top-level key
  {
    try {
      validateConfig({ unknownKey: "bad" });
      assert(false, "validateConfig: unknown top-level key should throw");
    } catch (e) {
      assert(e.message.includes("Unknown config key"), `validateConfig: unknown key throws with clear message — got: ${e.message}`);
    }
  }

  // Wrong type for profilesDir (not a string)
  {
    try {
      validateConfig({ profilesDir: 42 });
      assert(false, "validateConfig: non-string profilesDir should throw");
    } catch (e) {
      assert(e.message.includes("profilesDir"), `validateConfig: wrong type for profilesDir throws — got: ${e.message}`);
    }
  }

  // Invalid enabledProviders (not an array)
  {
    try {
      validateConfig({ enabledProviders: "npm" });
      assert(false, "validateConfig: non-array enabledProviders should throw");
    } catch (e) {
      assert(e.message.includes("enabledProviders"), `validateConfig: non-array enabledProviders throws — got: ${e.message}`);
    }
  }

  // enabledProviders with non-string entry
  {
    try {
      validateConfig({ enabledProviders: [42] });
      assert(false, "validateConfig: enabledProviders with non-string entry should throw");
    } catch (e) {
      assert(e.message.includes("enabledProviders"), `validateConfig: non-string provider entry throws — got: ${e.message}`);
    }
  }
}

// ─── Test: weekly --dry-run (F-TST-013) ──────────────────────────────────────

console.log("\n=== weekly --dry-run ===\n");

{
  const { execute: weeklyExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "weekly.mjs")).href
  );

  // Suppress all output during weekly (it runs audit + fix internally)
  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);
  process.stdout.write = () => true;
  process.stderr.write = () => true;

  let weeklyCode;
  try {
    weeklyCode = await weeklyExecute({ "dry-run": true });
  } finally {
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
  }

  assert(typeof weeklyCode === "number", "weekly --dry-run: returns a numeric exit code");
  assert([0, 2, 3, 5, 6].includes(weeklyCode), `weekly --dry-run: exit code is a known value (got ${weeklyCode})`);
}

// ─── Test: providers command (F-TST-014) ──────────────────────────────────────

console.log("\n=== providers command ===\n");

{
  const { execute: providersExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "providers.mjs")).href
  );

  // --json output is parseable JSON
  {
    const origStdout = process.stdout.write.bind(process.stdout);
    let jsonOut = "";
    process.stdout.write = (chunk) => { jsonOut += chunk; return true; };

    let code;
    try {
      code = await providersExecute({ json: true });
    } finally {
      process.stdout.write = origStdout;
    }

    assert(code === 0, "providers --json: exits 0");
    let parsed;
    try {
      parsed = JSON.parse(jsonOut);
      assert(true, "providers --json: output is parseable JSON");
    } catch {
      assert(false, "providers --json: output is parseable JSON");
    }
    if (parsed) {
      assert(Array.isArray(parsed), "providers --json: output is a JSON array");
      assert(parsed.length >= 5, `providers --json: at least 5 providers returned (got ${parsed?.length})`);
      const providerNames = parsed.map(p => p.name);
      assert(providerNames.includes("npm"), "providers --json: npm appears in output");
      assert(providerNames.includes("github"), "providers --json: github appears in output");
    }
  }

  // Human-readable output contains provider names
  {
    const origStdout = process.stdout.write.bind(process.stdout);
    let humanOut = "";
    process.stdout.write = (chunk) => { humanOut += chunk; return true; };

    let code;
    try {
      code = await providersExecute({});
    } finally {
      process.stdout.write = origStdout;
    }

    assert(code === 0, "providers (human): exits 0");
    assert(humanOut.includes("npm"), "providers (human): output includes 'npm'");
    assert(humanOut.includes("github"), "providers (human): output includes 'github'");
  }
}

// ─── Test: index-writer.mjs (F-TST-015) ──────────────────────────────────────

console.log("\n=== index-writer ===\n");

{
  const { mkdtempSync: mkdtemp3 } = await import("node:fs");
  const { tmpdir: tmpdir3 } = await import("node:os");
  const { readFileSync: rfs } = await import("node:fs");
  const { updateReceiptsIndex, updatePublishEntry, updateFixEntry } = await import(
    pathToFileURL(join(__dirname, "..", "src", "receipts", "index-writer.mjs")).href
  );

  const tmpDir = mkdtemp3(join(tmpdir3(), "mcpt-index-test-"));

  try {
    // Update with audit data
    const auditReceipt = {
      timestamp: new Date().toISOString(),
      counts: { RED: 1, YELLOW: 2, GRAY: 3 },
      totalPackages: 6,
    };
    updateReceiptsIndex(tmpDir, auditReceipt);

    const indexAfterAudit = JSON.parse(rfs(join(tmpDir, "index.json"), "utf8"));
    assert(indexAfterAudit.latestAudit !== null, "index-writer: updateReceiptsIndex sets latestAudit");
    assert(indexAfterAudit.latestAudit.totalPackages === 6, "index-writer: latestAudit.totalPackages is correct");
    assert(indexAfterAudit.latestAudit.counts.RED === 1, "index-writer: latestAudit.counts.RED is correct");

    // Update with publish data
    const publishReceipt = {
      target: "npm",
      packageName: "@mcptoolshop/test-pkg",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      commitSha: "a".repeat(40),
    };
    updatePublishEntry(tmpDir, publishReceipt);

    const indexAfterPublish = JSON.parse(rfs(join(tmpDir, "index.json"), "utf8"));
    const publishKey = "npm/@mcptoolshop/test-pkg";
    assert(indexAfterPublish.publish?.[publishKey] !== undefined, "index-writer: updatePublishEntry sets publish entry");
    assert(indexAfterPublish.publish[publishKey].version === "1.0.0", "index-writer: publish entry version is correct");

    // Update with fix data
    const fixReceipt = {
      repo: "mcp-tool-shop-org/test-pkg",
      mode: "dry-run",
      dryRun: true,
      timestamp: new Date().toISOString(),
      changes: [{ fixerCode: "npm-homepage", target: "npm" }],
    };
    updateFixEntry(tmpDir, fixReceipt);

    const indexAfterFix = JSON.parse(rfs(join(tmpDir, "index.json"), "utf8"));
    const fixKey = "mcp-tool-shop-org/test-pkg";
    assert(indexAfterFix.fix?.[fixKey] !== undefined, "index-writer: updateFixEntry sets fix entry");
    assert(indexAfterFix.fix[fixKey].mode === "dry-run", "index-writer: fix entry mode is correct");
    assert(indexAfterFix.fix[fixKey].changesCount === 1, "index-writer: fix entry changesCount is correct");
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
}

// ─── Test: github-glue.mjs regex (F-TST-016) ─────────────────────────────────

console.log("\n=== github-glue receipt section regex ===\n");

{
  // Test the receipt section regex pattern from github-glue.mjs directly,
  // without requiring gh CLI access.
  // The regex: /### Recent Receipts[\s\S]*?(?=\n###|\n---|\n## |$)/
  const receiptSectionRegex = /### Recent Receipts[\s\S]*?(?=\n###|\n---|\n## |$)/;

  // Case 1: body contains an existing "### Recent Receipts" section — regex should match
  const bodyWithSection = [
    "## Publishing Health",
    "",
    "Status: OK",
    "",
    "### Recent Receipts",
    "- **npm** @mcptoolshop/mcpt@1.0.0 — [release](https://github.com/...)",
    "",
    "### Other Section",
    "Some text",
  ].join("\n");

  const match = receiptSectionRegex.exec(bodyWithSection);
  assert(match !== null, "github-glue regex: matches '### Recent Receipts' section in body");
  assert(match[0].includes("Recent Receipts"), "github-glue regex: matched text contains 'Recent Receipts'");
  assert(!match[0].includes("### Other Section"), "github-glue regex: match stops before next ### section");

  // Case 2: body with receipt section followed by ---
  const bodyWithHr = [
    "## Publishing Health",
    "### Recent Receipts",
    "- item",
    "",
    "---",
    "Footer",
  ].join("\n");

  const matchHr = receiptSectionRegex.exec(bodyWithHr);
  assert(matchHr !== null, "github-glue regex: matches section followed by ---");
  assert(!matchHr[0].includes("Footer"), "github-glue regex: match stops before ---");

  // Case 3: body WITHOUT receipt section — regex should not match
  const bodyNoSection = "## Health\n\nNo receipts yet.\n";
  assert(!receiptSectionRegex.test(bodyNoSection), "github-glue regex: no match when section absent");
}

// ─── Test: publish --dry-run with no manifest (F-TST-017) ────────────────────

console.log("\n=== publish --dry-run no manifest ===\n");

{
  const { mkdtempSync: mkdtemp4 } = await import("node:fs");
  const { tmpdir: tmpdir4 } = await import("node:os");
  const { execute: publishExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "publish.mjs")).href
  );

  // Create a temp dir with a publishing.config.json but NO profiles/manifest.json
  const tmpDir = mkdtemp4(join(tmpdir4(), "mcpt-publish-test-"));
  const { writeFileSync: wfsP, mkdirSync: mksP } = await import("node:fs");
  const cfgPath = join(tmpDir, "publishing.config.json");
  wfsP(cfgPath, JSON.stringify({ profilesDir: join(tmpDir, "profiles"), receiptsDir: join(tmpDir, "receipts") }) + "\n");

  const prevEnv = process.env.PUBLISHING_CONFIG;
  process.env.PUBLISHING_CONFIG = cfgPath;

  const origStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  let publishCode;
  try {
    publishCode = await publishExecute({ "dry-run": true });
  } finally {
    process.stderr.write = origStderr;
    if (prevEnv === undefined) delete process.env.PUBLISHING_CONFIG;
    else process.env.PUBLISHING_CONFIG = prevEnv;
    rmSync(tmpDir, { recursive: true });
  }

  assert(typeof publishCode === "number", "publish --dry-run no manifest: returns numeric exit code");
  assert(publishCode !== 0, "publish --dry-run no manifest: returns non-zero (config error)");
}

// ─── Test: fix command filter logic via dry-run (F-TST-018) ──────────────────

console.log("\n=== fix command filter logic (dry-run) ===\n");

{
  const { mkdtempSync: mkdtemp5 } = await import("node:fs");
  const { tmpdir: tmpdir5 } = await import("node:os");
  const { execute: fixExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "fix.mjs")).href
  );

  // Create a temp dir with config but no manifest — fix should return CONFIG_ERROR
  const tmpDir = mkdtemp5(join(tmpdir5(), "mcpt-fix-test-"));
  const { writeFileSync: wfsF } = await import("node:fs");
  const cfgPath = join(tmpDir, "publishing.config.json");
  wfsF(cfgPath, JSON.stringify({ profilesDir: join(tmpDir, "profiles"), receiptsDir: join(tmpDir, "receipts") }) + "\n");

  const prevEnv = process.env.PUBLISHING_CONFIG;
  process.env.PUBLISHING_CONFIG = cfgPath;

  const origStderr2 = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  let fixCode;
  try {
    fixCode = await fixExecute({ "dry-run": true });
  } finally {
    process.stderr.write = origStderr2;
    if (prevEnv === undefined) delete process.env.PUBLISHING_CONFIG;
    else process.env.PUBLISHING_CONFIG = prevEnv;
    rmSync(tmpDir, { recursive: true });
  }

  assert(typeof fixCode === "number", "fix --dry-run no manifest: returns numeric exit code");
  // CONFIG_ERROR (3) when manifest is missing
  assert(fixCode === 3, `fix --dry-run no manifest: returns CONFIG_ERROR (3), got ${fixCode}`);
}

// ─── Test: assets command — plugin absent path (F-TST-023) ───────────────────

console.log("\n=== assets command — plugin absent ===\n");

{
  const { execute: assetsExecute } = await import(
    pathToFileURL(join(__dirname, "..", "src", "commands", "assets.mjs")).href
  );

  // Capture both stdout and stderr — plugin-present prints to stdout, absent prints to stderr
  const origStderr = process.stderr.write.bind(process.stderr);
  const origStdout = process.stdout.write.bind(process.stdout);
  let allOut = "";
  process.stderr.write = (chunk) => { allOut += chunk; return true; };
  process.stdout.write = (chunk) => { allOut += chunk; return true; };

  let assetsCode;
  try {
    assetsCode = await assetsExecute({ _positionals: [] });
  } finally {
    process.stderr.write = origStderr;
    process.stdout.write = origStdout;
  }

  assert(assetsCode === 0, "assets: exits 0");
  // Plugin may or may not be installed — both paths exit 0
  assert(
    allOut.includes("not installed") || allOut.includes("Install") || allOut.includes("Subcommands"),
    "assets: output includes install hint or subcommand list"
  );
}

// ─── Test: NpmProvider classify() logic (FT-TST-004) ─────────────────────────
//
// #classify is a private JS class field — not accessible from outside the class.
// We test it indirectly through audit(), which calls #classify internally.
// audit() takes (entry, ctx) where ctx.tags and ctx.releases are Maps of
// repoKey -> string[].  We stub #fetchMeta by overriding the exec path:
// since audit() calls this.#fetchMeta which calls execArgs (not imported here),
// we can't easily stub that.  Instead, we subclass NpmProvider and override
// a testable surface, OR we test via a monkey-patch of the private method slot.
//
// Approach: expose classify via a thin test-subclass that calls the private method.

console.log("\n=== NpmProvider classify() logic (FT-TST-004) ===\n");

{
  const NpmProviderModule = await import(
    pathToFileURL(join(__dirname, "lib", "providers", "npm.mjs")).href
  );
  const NpmProvider = NpmProviderModule.default;

  // Since JavaScript private fields (#classify) cannot be accessed outside the class
  // body, we test classify() logic exclusively through the audit() public method.
  // For the null-meta branch we use a package name guaranteed to be unreachable.
  // For meta-dependent branches (published-not-tagged, tagged-not-released,
  // wrong-repo-url, missing-homepage, bad-description), testing requires either
  // a mock exec layer or a real published package with known state.
  // Those branches are tracked for full coverage in PB-TST-013 (node:test migration).


  const npmProviderForClassify = new NpmProvider();

  // Branch: null meta → npm-unreachable finding
  // We test this by calling audit() with a package name that will fail npm view.
  // In CI and offline environments, any scoped unknown package returns non-zero.
  {
    // Use a deliberately invalid package name to guarantee npm view fails
    const entry = { name: "@__mcpt-test-nonexistent-pkg-xyz__/no-such-package", repo: "mcp-tool-shop-org/no-such-package", audience: "front-door", ecosystem: "npm" };
    const ctx = {
      tags: new Map([["mcp-tool-shop-org/no-such-package", []]]),
      releases: new Map([["mcp-tool-shop-org/no-such-package", []]]),
    };
    let auditResult;
    try {
      auditResult = await npmProviderForClassify.audit(entry, ctx);
    } catch (e) {
      auditResult = null;
    }
    if (auditResult !== null) {
      const unreach = auditResult.findings.find(f => f.code === "npm-unreachable");
      assert(unreach !== undefined, "NpmProvider.classify: null meta → npm-unreachable finding");
      assert(unreach.severity === "RED", "NpmProvider.classify: npm-unreachable has RED severity");
    } else {
      assert(false, "NpmProvider.classify: audit() should not throw for unreachable package");
    }
  }

  // Branch: published version not in tags → published-not-tagged RED
  // We test this through a mock entry where tags is empty (no v<ver> tag).
  // This branch is only reached when meta is non-null — we cannot easily produce
  // non-null meta without a real npm view call. We verify the branch structure
  // by inspecting the source behavior documented above and asserting on the
  // detect() and receipt() methods which are fully testable.
  // NOTE: full published-not-tagged branch coverage requires either:
  //   a) a mock exec layer, or
  //   b) a network call to a real published package
  // Track as PB-TST-013 (migrate to node:test with proper stubs).

  // Branch: wrong-repo-url RED — test via a real published package known to have
  // a repo URL that won't match a fabricated repo slug.
  // (Network-dependent; skipped in offline CI — see PB-TST-013)

  // What we CAN test without network: verify that the findings array has the right
  // shape when meta IS null (already covered above) and that detect() guards the entry.
  assert(npmProviderForClassify.detect({ ecosystem: "npm" }) === true, "NpmProvider.classify: detect guards npm entries");
  assert(npmProviderForClassify.detect({ ecosystem: "github" }) === false, "NpmProvider.classify: detect rejects non-npm entries");

  // Verify audit() return shape is always { version, findings: Array }
  {
    const entry2 = { name: "@__mcpt-test-shape__/no-such", repo: "org/no-such", audience: "front-door", ecosystem: "npm" };
    const ctx2 = { tags: new Map(), releases: new Map() };
    const result2 = await npmProviderForClassify.audit(entry2, ctx2);
    assert(result2 !== null && typeof result2 === "object", "NpmProvider.audit: returns object");
    assert(Array.isArray(result2.findings), "NpmProvider.audit: findings is an array");
    assert(typeof result2.version === "string", "NpmProvider.audit: version is a string");
  }
}

// ─── Test: emitAuditReceipt and emitFixReceipt (FT-TST-005) ──────────────────

console.log("\n=== emitAuditReceipt and emitFixReceipt (FT-TST-005) ===\n");

{
  const { emitAuditReceipt } = await import(
    pathToFileURL(join(__dirname, "..", "src", "receipts", "audit-receipt.mjs")).href
  );
  const { emitFixReceipt } = await import(
    pathToFileURL(join(__dirname, "..", "src", "receipts", "fix-receipt.mjs")).href
  );

  const tmpDir5 = mkdtempSync(join(tmpdir(), "mcpt-receipt-emit-test-"));

  try {
    // Build a fake config with all required dirs pointing into tmpdir
    const fakeConfig = {
      receiptsDir: join(tmpDir5, "receipts"),
      reportsDir: join(tmpDir5, "reports"),
    };

    // ─── emitAuditReceipt ───────────────────────────────────────────────────

    const auditResults = {
      npm: [
        { name: "@mcptoolshop/pkg-a", findings: [] },
        { name: "@mcptoolshop/pkg-b", findings: [{ severity: "RED", code: "npm-unreachable" }] },
      ],
      nuget: [],
      counts: { RED: 1, YELLOW: 0, GRAY: 0 },
    };

    const auditReceiptPath = emitAuditReceipt(fakeConfig, auditResults);

    assert(existsSync(auditReceiptPath), "emitAuditReceipt: file exists at returned path");

    const auditReceiptData = JSON.parse(readFileSync(auditReceiptPath, "utf8"));
    assert(auditReceiptData.schemaVersion === "1.0.0", "emitAuditReceipt: schemaVersion is 1.0.0");
    assert(auditReceiptData.type === "audit", "emitAuditReceipt: type is 'audit'");
    assert(typeof auditReceiptData.timestamp === "string" && auditReceiptData.timestamp.length > 0, "emitAuditReceipt: timestamp is present");
    assert(auditReceiptData.counts?.RED === 1, "emitAuditReceipt: counts.RED matches input");
    assert(auditReceiptData.totalPackages === 2, "emitAuditReceipt: totalPackages counts npm entries (2 npm, 0 nuget)");
    assert(auditReceiptData.ecosystems?.npm === 2, "emitAuditReceipt: ecosystems.npm is 2");
    assert(auditReceiptData.ecosystems?.nuget === 0, "emitAuditReceipt: ecosystems.nuget is 0");

    // ─── emitFixReceipt ─────────────────────────────────────────────────────

    const fixResult = {
      repo: "mcp-tool-shop-org/test-pkg",
      mode: "dry-run",
      dryRun: true,
      changes: [
        { fixerCode: "npm-homepage", target: "npm", field: "homepage", before: "(missing)", after: "https://github.com/org/repo" },
        { fixerCode: "npm-keywords", target: "npm", field: "keywords", before: "(missing)", after: "mcp,tool" },
      ],
      auditBefore: { RED: 2, YELLOW: 0, GRAY: 3 },
      commitSha: null,
      prUrl: null,
      branchName: null,
    };

    const fixReceiptPath = emitFixReceipt(fakeConfig, fixResult);

    assert(existsSync(fixReceiptPath), "emitFixReceipt: file exists at returned path");

    const fixReceiptData = JSON.parse(readFileSync(fixReceiptPath, "utf8"));
    assert(fixReceiptData.schemaVersion === "1.0.0", "emitFixReceipt: schemaVersion is 1.0.0");
    assert(fixReceiptData.type === "fix", "emitFixReceipt: type is 'fix'");
    assert(typeof fixReceiptData.timestamp === "string" && fixReceiptData.timestamp.length > 0, "emitFixReceipt: timestamp is present");
    assert(fixReceiptData.repo === "mcp-tool-shop-org/test-pkg", "emitFixReceipt: repo matches input");
    assert(fixReceiptData.mode === "dry-run", "emitFixReceipt: mode is dry-run");
    assert(fixReceiptData.dryRun === true, "emitFixReceipt: dryRun is true");
    assert(Array.isArray(fixReceiptData.changes) && fixReceiptData.changes.length === 2, "emitFixReceipt: changes array has 2 entries");
    assert(fixReceiptData.auditAfterPending === true, "emitFixReceipt: auditAfterPending is true");
    assert(fixReceiptData.auditAfter === null, "emitFixReceipt: auditAfter is null (post-fix audit not yet implemented)");

    // Verify the receipts index was updated by emitAuditReceipt
    const indexPath = join(fakeConfig.receiptsDir, "index.json");
    assert(existsSync(indexPath), "emitAuditReceipt: updates receipts/index.json");
    const indexData = JSON.parse(readFileSync(indexPath, "utf8"));
    assert(indexData.latestAudit !== null, "emitAuditReceipt: index.latestAudit is set");
    assert(indexData.latestAudit.totalPackages === 2, "emitAuditReceipt: index.latestAudit.totalPackages is 2");

  } finally {
    rmSync(tmpDir5, { recursive: true });
  }
}

// ─── Test: Receipt path traversal validation (FT-TST-008) ────────────────────

console.log("\n=== Receipt path traversal validation (FT-TST-008) ===\n");

{
  // These tests use the validate() function from receipt-writer.mjs.
  // A valid base receipt is used and only the field under test is modified.
  const { createHash: ch008 } = await import("node:crypto");
  const sha008 = ch008("sha256").update("traversal-test").digest("hex");
  const baseReceipt = {
    schemaVersion: "1.0.0",
    repo: { owner: "mcp-tool-shop-org", name: "test-pkg" },
    target: "npm",
    version: "1.0.0",
    packageName: "@mcptoolshop/test-pkg",
    commitSha: "b".repeat(40),
    timestamp: new Date().toISOString(),
    artifacts: [{
      name: "test-pkg-1.0.0.tgz",
      sha256: sha008,
      size: 9999,
      url: "https://registry.npmjs.org/@mcptoolshop/test-pkg/-/test-pkg-1.0.0.tgz",
    }],
  };

  // Negative test 1: owner containing '..'
  try {
    validate({ ...baseReceipt, repo: { owner: "org/../evil", name: "test-pkg" } });
    assert(false, "Path traversal: owner containing '..' should throw");
  } catch (e) {
    assert(
      e.message.includes("owner") || e.message.includes("invalid path"),
      `Path traversal: owner with '..' rejected — got: ${e.message}`
    );
  }

  // Negative test 2: name containing '/'
  try {
    validate({ ...baseReceipt, repo: { owner: "mcp-tool-shop-org", name: "a/b" } });
    assert(false, "Path traversal: name containing '/' should throw");
  } catch (e) {
    assert(
      e.message.includes("name") || e.message.includes("invalid path"),
      `Path traversal: name with '/' rejected — got: ${e.message}`
    );
  }

  // Negative test 3: version containing '..'
  try {
    validate({ ...baseReceipt, version: "../../../etc/passwd" });
    assert(false, "Path traversal: version containing '..' should throw");
  } catch (e) {
    assert(
      e.message.includes("version") || e.message.includes("invalid path"),
      `Path traversal: version with '..' rejected — got: ${e.message}`
    );
  }
}

// ─── Test: EXIT.UNEXPECTED_ERROR = 7 (FT-TST-011) ────────────────────────────
//
// The exit codes section above (line ~360) tests SUCCESS through FIX_FAILURE.
// FT-TST-011 adds the assertion for UNEXPECTED_ERROR = 7.

console.log("\n=== EXIT.UNEXPECTED_ERROR (FT-TST-011) ===\n");

{
  // EXIT was already imported in the Exit Codes section above — re-import to
  // keep this section self-contained and avoid dependency on execution order.
  const { EXIT: EXIT011 } = await import(
    pathToFileURL(join(__dirname, "..", "src", "cli", "exit-codes.mjs")).href
  );
  assert(EXIT011.UNEXPECTED_ERROR === 7, "EXIT.UNEXPECTED_ERROR is 7");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${"=".repeat(50)}\n`);

process.exit(fail > 0 ? 1 : 0);
