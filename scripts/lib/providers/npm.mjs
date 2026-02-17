/**
 * npm provider — extracted from audit.mjs.
 *
 * Fetches metadata via `npm view` and classifies drift against git state.
 */

import { execSync } from "node:child_process";
import { Provider } from "../provider.mjs";

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
