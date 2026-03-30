/**
 * NuGet provider — audit + publish.
 *
 * Audit: fetches metadata via NuGet search API + flat-container,
 *        detects indexing lag, and classifies drift against git state.
 * Publish: packs .nupkg, computes SHA-256, pushes to nuget.org.
 */

import { readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Provider } from "../provider.mjs";
import { exec, execArgs, hashFile, getCommitSha } from "../shell.mjs";

// NuGet search endpoint — override via env var if the default US North-Central
// region is unreachable or if you need to point at a private NuGet feed.
// Canonical discovery: GET https://api.nuget.org/v3/index.json and look for the
// resource with @type "SearchQueryService" — that URL is the authoritative value.
const NUGET_SEARCH_URL = process.env.NUGET_SEARCH_URL ?? "https://azuresearch-usnc.nuget.org/query";

export default class NuGetProvider extends Provider {
  get name() { return "nuget"; }

  detect(entry) {
    return entry.ecosystem === "nuget";
  }

  async audit(entry, ctx) {
    this._fetchMetaError = null;
    this._fetchVersionsError = null;
    const meta = await this.#fetchMeta(entry.name);
    // Short-circuit: if the search API already failed, flat-container likely will too.
    const flatVersions = meta !== null ? await this.#fetchVersions(entry.name) : [];
    const tags = ctx.tags.get(entry.repo) ?? [];
    const releases = ctx.releases.get(entry.repo) ?? [];

    const version = flatVersions.length > 0
      ? flatVersions[flatVersions.length - 1]
      : (meta?.version ?? "?");

    const findings = this.#classify(entry, meta, tags, releases, flatVersions);
    return { version, findings };
  }

  /**
   * Publish a NuGet package.
   *
   * @param {object} entry - { name, repo, audience, ecosystem }
   * @param {object} opts  - { dryRun: boolean, cwd: string }
   * @returns {Promise<{ success: boolean, version: string, artifacts: Array, error?: string }>}
   */
  async publish(entry, opts = {}) {
    const cwd = opts.cwd ?? process.cwd();

    // Check credentials (skip in dry-run — dotnet pack doesn't need auth)
    if (!process.env.NUGET_API_KEY && !opts.dryRun) {
      return { success: false, version: "", artifacts: [], error: "NUGET_API_KEY environment variable is not set" };
    }

    const outputDir = join(cwd, "nupkg-output");

    // dotnet pack
    const packResult = exec("dotnet pack -c Release -o nupkg-output", { cwd });
    if (packResult.exitCode !== 0) {
      return { success: false, version: "", artifacts: [], error: `dotnet pack failed: ${packResult.stderr}` };
    }

    // Find the .nupkg matching the package name
    if (!existsSync(outputDir)) {
      return { success: false, version: "", artifacts: [], error: "nupkg-output directory not created by dotnet pack" };
    }

    const nupkgFiles = readdirSync(outputDir).filter(f => f.endsWith(".nupkg") && !f.endsWith(".symbols.nupkg"));
    const targetNupkg = nupkgFiles.find(f => f.toLowerCase().startsWith(entry.name.toLowerCase() + "."));

    if (!targetNupkg) {
      // Clean up
      try { rmSync(outputDir, { recursive: true }); } catch { /* ignore */ }
      return {
        success: false, version: "", artifacts: [],
        error: `No .nupkg found matching "${entry.name}" in nupkg-output/ (found: ${nupkgFiles.join(", ") || "none"})`,
      };
    }

    // Extract version from filename: PackageName.1.2.3.nupkg
    const nupkgBasename = targetNupkg.replace(/\.nupkg$/, "");
    const version = nupkgBasename.slice(entry.name.length + 1); // +1 for the dot

    if (!version) {
      try { rmSync(outputDir, { recursive: true }); } catch { /* ignore */ }
      return { success: false, version: "", artifacts: [], error: `Could not parse version from ${targetNupkg}` };
    }

    // Compute SHA-256
    const nupkgPath = join(outputDir, targetNupkg);
    let sha256, size;
    try {
      ({ sha256, size } = hashFile(nupkgPath));
    } catch (e) {
      try { rmSync(outputDir, { recursive: true }); } catch { /* ignore */ }
      return { success: false, version, artifacts: [], error: `Failed to hash ${targetNupkg}: ${e.message}` };
    }

    // Push (or dry-run)
    if (!opts.dryRun) {
      // SECURITY NOTE: passing --api-key as a CLI argument exposes the key value in
      // the OS process list (visible to other users via `ps` / Task Manager).
      // A more secure alternative is to store the key in a NuGet.Config file
      // (dotnet nuget add source --api-key) so it never appears on the command line.
      // Changing this mechanism is a larger refactor; accepted risk for now.
      const pushResult = execArgs(
        "dotnet",
        ["nuget", "push", nupkgPath, "--api-key", process.env.NUGET_API_KEY, "--source", "https://api.nuget.org/v3/index.json", "--skip-duplicate"],
        { cwd }
      );
      if (pushResult.exitCode !== 0) {
        try { rmSync(outputDir, { recursive: true }); } catch { /* ignore */ }
        return { success: false, version, artifacts: [], error: `dotnet nuget push failed: ${pushResult.stderr}` };
      }
    }

    // Clean up
    try { rmSync(outputDir, { recursive: true }); } catch { /* ignore */ }

    // Build artifact metadata
    const artifact = {
      name: targetNupkg,
      sha256,
      size,
      url: `https://www.nuget.org/packages/${entry.name}/${version}`,
    };

    // Capture commit SHA for the receipt
    let commitSha = "";
    try { commitSha = getCommitSha(cwd); } catch { /* not in a git repo — leave blank */ }

    return { success: true, version, artifacts: [artifact], commitSha };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  async #fetchMeta(id) {
    // NUGET_SEARCH_URL is configured at module load (see top of file).
    // Override via the NUGET_SEARCH_URL environment variable if needed.
    const url = `${NUGET_SEARCH_URL}?q=packageid:${encodeURIComponent(id)}&take=1`;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        this._fetchMetaError = `NuGet search request timed out after 15 s`;
      } else {
        this._fetchMetaError = `NuGet search fetch error: ${e.message}`;
      }
      return null;
    }
    if (!res.ok) {
      this._fetchMetaError = `NuGet search responded HTTP ${res.status}`;
      return null;
    }
    try {
      const data = await res.json();
      return data.data?.[0] ?? null;
    } catch (e) {
      this._fetchMetaError = `NuGet search response parse failure: ${e.message}`;
      return null;
    }
  }

  /** Flat container returns actual published versions (updates faster than search). */
  async #fetchVersions(id) {
    const url = `https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(id).toLowerCase()}/index.json`;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        this._fetchVersionsError = `NuGet flat-container request timed out after 15 s`;
      } else {
        this._fetchVersionsError = `NuGet flat-container fetch error: ${e.message}`;
      }
      return [];
    }
    if (!res.ok) {
      this._fetchVersionsError = `NuGet flat-container responded HTTP ${res.status}`;
      return [];
    }
    try {
      const data = await res.json();
      return data.versions ?? [];
    } catch (e) {
      this._fetchVersionsError = `NuGet flat-container response parse failure: ${e.message}`;
      return [];
    }
  }

  #classify(pkg, meta, tags, releases, flatVersions) {
    const findings = [];

    if (!meta) {
      const reason = this._fetchMetaError ? ` (${this._fetchMetaError})` : "";
      findings.push({ severity: "RED", code: "nuget-unreachable", msg: `Cannot reach ${pkg.name} on NuGet${reason}` });
      return findings;
    }

    const searchVer = meta.version;
    const latestFlat = flatVersions.length > 0 ? flatVersions[flatVersions.length - 1] : null;

    // Detect indexing lag: flat container knows about a newer version than the search API
    const indexingLag = latestFlat && latestFlat.toLowerCase() !== searchVer.toLowerCase();
    const ver = latestFlat ?? searchVer;
    const tagName = `v${ver}`;

    // Published-but-not-tagged
    if (!tags.includes(tagName)) {
      findings.push({ severity: "RED", code: "published-not-tagged", msg: `${pkg.name}@${ver} — no git tag ${tagName}` });
    }

    // ProjectUrl — suppress during indexing lag (metadata not propagated yet)
    if (!meta.projectUrl && !indexingLag) {
      if (pkg.audience === "front-door") {
        findings.push({ severity: "YELLOW", code: "missing-project-url", msg: `${pkg.name} has no projectUrl on NuGet` });
      }
    }

    // Icon — suppress during indexing lag
    if (!meta.iconUrl && pkg.audience === "front-door" && !indexingLag) {
      findings.push({ severity: "YELLOW", code: "missing-icon", msg: `${pkg.name} (front-door) has no icon` });
    }

    // Indexing lag notice (non-failing)
    if (indexingLag) {
      findings.push({
        severity: "INFO",
        code: "pending-index",
        msg: `${pkg.name} v${latestFlat} published but search API still shows v${searchVer} — retry in 60-120 min`
      });
    }

    // Description
    if (!meta.description) {
      findings.push({ severity: "GRAY", code: "missing-description", msg: `${pkg.name} has no description` });
    }

    return findings;
  }

  receipt(result) {
    const [owner, name] = result.repo.split("/");
    return {
      schemaVersion: "1.0.0",
      repo: { owner, name },
      target: "nuget",
      version: result.version,
      packageName: result.name,
      commitSha: result.commitSha,
      timestamp: new Date().toISOString(),
      artifacts: result.artifacts ?? [],
    };
  }
}
