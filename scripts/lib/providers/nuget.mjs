/**
 * NuGet provider — extracted from audit.mjs.
 *
 * Fetches metadata via NuGet search API + flat-container,
 * detects indexing lag, and classifies drift against git state.
 */

import { execSync } from "node:child_process";
import { Provider } from "../provider.mjs";

export default class NuGetProvider extends Provider {
  get name() { return "nuget"; }

  detect(entry) {
    return entry.ecosystem === "nuget";
  }

  async audit(entry, ctx) {
    const meta = this.#fetchMeta(entry.name);
    const flatVersions = this.#fetchVersions(entry.name);
    const tags = ctx.tags.get(entry.repo) ?? [];
    const releases = ctx.releases.get(entry.repo) ?? [];

    const version = flatVersions.length > 0
      ? flatVersions[flatVersions.length - 1]
      : (meta?.version ?? "?");

    const findings = this.#classify(entry, meta, tags, releases, flatVersions);
    return { version, findings };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #fetchMeta(id) {
    try {
      const url = `https://azuresearch-usnc.nuget.org/query?q=packageid:${id}&take=1`;
      const raw = execSync(`curl -sf "${url}"`, { encoding: "utf8", timeout: 15_000 });
      const data = JSON.parse(raw);
      return data.data?.[0] ?? null;
    } catch { return null; }
  }

  /** Flat container returns actual published versions (updates faster than search). */
  #fetchVersions(id) {
    try {
      const url = `https://api.nuget.org/v3-flatcontainer/${id.toLowerCase()}/index.json`;
      const raw = execSync(`curl -sf "${url}"`, { encoding: "utf8", timeout: 15_000 });
      return JSON.parse(raw).versions ?? [];
    } catch { return []; }
  }

  #classify(pkg, meta, tags, releases, flatVersions) {
    const findings = [];

    if (!meta) {
      findings.push({ severity: "RED", code: "nuget-unreachable", msg: `Cannot reach ${pkg.name} on NuGet` });
      return findings;
    }

    const searchVer = meta.version;
    const latestFlat = flatVersions.length > 0 ? flatVersions[flatVersions.length - 1] : null;

    // Detect indexing lag: flat container knows about a newer version than the search API
    const indexingLag = latestFlat && latestFlat !== searchVer;
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
