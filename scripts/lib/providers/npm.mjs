/**
 * npm provider — audit + publish.
 *
 * Audit: fetches metadata via `npm view` and classifies drift against git state.
 * Publish: packs tarball, computes SHA-256, publishes to registry.
 */

import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Provider } from "../provider.mjs";
import { exec, hashFile, getCommitSha } from "../shell.mjs";

export default class NpmProvider extends Provider {
  get name() { return "npm"; }

  detect(entry) {
    return entry.ecosystem === "npm";
  }

  async audit(entry, ctx) {
    this._fetchMetaError = null;
    const meta = await this.#fetchMeta(entry.name);
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
    let sha256, size;
    try {
      ({ sha256, size } = hashFile(tarballPath));
    } catch (e) {
      try { unlinkSync(tarballPath); } catch { /* ignore */ }
      return { success: false, version, artifacts: [], error: `Failed to hash ${tarball}: ${e.message}` };
    }

    // Publish (or dry-run).
    // Timeout is 300 000 ms (5 min): npm publish can be slow on large tarballs or
    // under registry congestion, but anything beyond 5 min indicates a hung process
    // rather than normal latency — at that point aborting and retrying is safer.
    const publishCmd = opts.dryRun
      ? "npm publish --dry-run --access public"
      : "npm publish --access public";

    const pubResult = exec(publishCmd, { cwd, timeout: 300_000 });
    if (pubResult.exitCode !== 0) {
      // Clean up tarball on failure
      try { unlinkSync(tarballPath); } catch { /* ignore */ }
      return { success: false, version, artifacts: [], error: `npm publish failed: ${pubResult.stderr}` };
    }

    // Clean up tarball
    try { unlinkSync(tarballPath); } catch { /* ignore */ }

    // Build artifact metadata
    const artifact = {
      name: tarball,
      sha256,
      size,
      url: `https://www.npmjs.com/package/${entry.name}/v/${version}`,
    };

    // Capture commit SHA for the receipt
    let commitSha = "";
    try { commitSha = getCommitSha(cwd); } catch { /* not in a git repo — leave blank */ }

    return { success: true, version, artifacts: [artifact], commitSha };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  async #fetchMeta(pkgName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        this._fetchMetaError = `npm registry request timed out after 15 s`;
      } else {
        this._fetchMetaError = `npm registry fetch error: ${e.message}`;
      }
      return null;
    }
    if (res.status === 404) {
      this._fetchMetaError = `package not found on npm registry`;
      return null;
    }
    if (!res.ok) {
      this._fetchMetaError = `npm registry responded HTTP ${res.status}`;
      return null;
    }
    try {
      const data = await res.json();
      // Normalize to the shape that #classify() expects:
      // dist-tags.latest, version, repository.url, description, readme, homepage, bugs.url, keywords
      const latest = data["dist-tags"]?.latest;
      const versionMeta = latest ? (data.versions?.[latest] ?? {}) : {};
      return {
        "dist-tags": data["dist-tags"],
        version: latest,
        repository: versionMeta.repository ?? data.repository,
        description: versionMeta.description ?? data.description,
        readme: data.readme,
        homepage: versionMeta.homepage ?? data.homepage,
        bugs: versionMeta.bugs ?? data.bugs,
        keywords: versionMeta.keywords ?? data.keywords,
      };
    } catch (e) {
      this._fetchMetaError = `npm registry response parse failure: ${e.message}`;
      return null;
    }
  }

  #classify(pkg, meta, tags, releases) {
    const findings = [];

    if (!meta) {
      const reason = this._fetchMetaError ? ` (${this._fetchMetaError})` : "";
      findings.push({ severity: "RED", code: "npm-unreachable", msg: `Cannot reach ${pkg.name} on npm${reason}` });
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

    // Repo URL check — normalize both sides to bare "org/repo" before comparing.
    // npm repository.url can appear as: "git+https://github.com/org/repo.git",
    // "git://github.com/org/repo", "https://github.com/org/repo", etc.
    const repoUrl = meta.repository?.url ?? "";
    const normalizeRepoUrl = (url) => url
      .replace(/^git\+/, "")
      .replace(/^git:\/\//, "")
      .replace(/^https?:\/\//, "")
      .replace(/^github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "");
    const normalizedUrl = normalizeRepoUrl(repoUrl);
    const normalizedExpected = normalizeRepoUrl(pkg.repo);
    if (!normalizedUrl || normalizedUrl !== normalizedExpected) {
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

    // Bugs URL
    if (!meta.bugs?.url) {
      findings.push({ severity: "GRAY", code: "missing-bugs-url", msg: `${pkg.name} has no bugs URL` });
    }

    // Keywords
    if (!meta.keywords?.length) {
      findings.push({ severity: "GRAY", code: "missing-keywords", msg: `${pkg.name} has no keywords` });
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
