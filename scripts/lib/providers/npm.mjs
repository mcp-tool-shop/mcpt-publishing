/**
 * npm provider — audit + publish.
 *
 * Audit: fetches metadata via `npm view` and classifies drift against git state.
 * Publish: packs tarball, computes SHA-256, publishes to registry.
 */

import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Provider } from "../provider.mjs";
import { exec, hashFile } from "../shell.mjs";

export default class NpmProvider extends Provider {
  get name() { return "npm"; }

  detect(entry) {
    return entry.ecosystem === "npm";
  }

  async audit(entry, ctx) {
    const meta = this.#fetchMeta(entry.name);
    const tags = ctx.tags.get(entry.repo) ?? [];
    const releases = ctx.releases.get(entry.repo) ?? [];

    const version = meta?.["dist-tags"]?.latest ?? meta?.version ?? "?";
    const findings = this.#classify(entry, meta, tags, releases);

    return { version, findings };
  }

  /**
   * Publish an npm package.
   *
   * @param {object} entry - { name, repo, audience, ecosystem }
   * @param {object} opts  - { dryRun: boolean, cwd: string }
   * @returns {Promise<{ success: boolean, version: string, artifacts: Array, error?: string }>}
   */
  async publish(entry, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();

    // Check credentials (skip in dry-run — npm pack doesn't need auth)
    if (!process.env.NPM_TOKEN && !opts.dryRun) {
      return { success: false, version: "", artifacts: [], error: "NPM_TOKEN environment variable is not set" };
    }

    // Read version from package.json
    const pkgJsonPath = join(cwd, "package.json");
    if (!existsSync(pkgJsonPath)) {
      return { success: false, version: "", artifacts: [], error: `No package.json found in ${cwd}` };
    }
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    const version = pkgJson.version;

    if (!version) {
      return { success: false, version: "", artifacts: [], error: "No version field in package.json" };
    }

    // npm pack → get tarball
    const packResult = exec("npm pack --json", { cwd });
    if (packResult.exitCode !== 0) {
      return { success: false, version, artifacts: [], error: `npm pack failed: ${packResult.stderr}` };
    }

    let packInfo;
    try {
      const parsed = JSON.parse(packResult.stdout);
      packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return { success: false, version, artifacts: [], error: "Failed to parse npm pack output" };
    }

    const tarball = packInfo.filename;
    const tarballPath = join(cwd, tarball);

    // Compute SHA-256
    const { sha256, size } = hashFile(tarballPath);

    // Publish (or dry-run)
    const publishCmd = opts.dryRun
      ? "npm publish --dry-run --access public"
      : "npm publish --access public";

    const pubResult = exec(publishCmd, { cwd });
    if (pubResult.exitCode !== 0) {
      // Clean up tarball on failure
      try { unlinkSync(tarballPath); } catch { /* ignore */ }
      return { success: false, version, artifacts: [], error: `npm publish failed: ${pubResult.stderr}` };
    }

    // Clean up tarball
    try { unlinkSync(tarballPath); } catch { /* ignore */ }

    // Build artifact metadata
    const scopedName = entry.name.replace(/^@/, "").replace(/\//, "-");
    const artifact = {
      name: tarball,
      sha256,
      size,
      url: `https://www.npmjs.com/package/${entry.name}/v/${version}`,
    };

    return { success: true, version, artifacts: [artifact] };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #fetchMeta(pkg) {
    try {
      const raw = execSync(`npm view ${pkg} --json 2>&1`, { encoding: "utf8", timeout: 15_000 });
      return JSON.parse(raw);
    } catch { return null; }
  }

  #classify(pkg, meta, tags, releases) {
    const findings = [];

    if (!meta) {
      findings.push({ severity: "RED", code: "npm-unreachable", msg: `Cannot reach ${pkg.name} on npm` });
      return findings;
    }

    const ver = meta["dist-tags"]?.latest ?? meta.version;
    const tagName = `v${ver}`;

    // Published-but-not-tagged
    if (!tags.includes(tagName)) {
      findings.push({ severity: "RED", code: "published-not-tagged", msg: `${pkg.name}@${ver} — no git tag ${tagName}` });
    }

    // Tagged-but-not-released
    if (tags.includes(tagName) && !releases.includes(tagName) && pkg.audience === "front-door") {
      findings.push({ severity: "YELLOW", code: "tagged-not-released", msg: `${pkg.name} tag ${tagName} has no GitHub Release` });
    }

    // Repo URL check
    const repoUrl = meta.repository?.url ?? "";
    if (!repoUrl.includes(pkg.repo.split("/")[0])) {
      findings.push({ severity: "RED", code: "wrong-repo-url", msg: `${pkg.name} repo URL "${repoUrl}" doesn't match expected ${pkg.repo}` });
    }

    // Description
    const desc = meta.description ?? "";
    if (!desc || desc.startsWith("<") || desc.includes("<img")) {
      findings.push({ severity: "RED", code: "bad-description", msg: `${pkg.name} has missing/HTML description` });
    }

    // README
    if (meta.readme === "ERROR: No README data found!" || meta.readme === "") {
      if (pkg.audience === "front-door") {
        findings.push({ severity: "YELLOW", code: "missing-readme", msg: `${pkg.name} has no README on npm` });
      } else {
        findings.push({ severity: "GRAY", code: "missing-readme", msg: `${pkg.name} (internal) has no README on npm` });
      }
    }

    // Homepage
    if (!meta.homepage) {
      findings.push({ severity: "GRAY", code: "missing-homepage", msg: `${pkg.name} has no homepage` });
    }

    return findings;
  }

  receipt(result) {
    const [owner, name] = result.repo.split("/");
    return {
      schemaVersion: "1.0.0",
      repo: { owner, name },
      target: "npm",
      version: result.version,
      packageName: result.name,
      commitSha: result.commitSha,
      timestamp: new Date().toISOString(),
      artifacts: result.artifacts ?? [],
    };
  }
}
