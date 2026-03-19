/**
 * GHCR provider — audits container images on GitHub Container Registry.
 *
 * Uses `gh api` to query package versions via the GitHub Packages API.
 */

import { Provider } from "../provider.mjs";
import { execArgs } from "../shell.mjs";

export default class GhcrProvider extends Provider {
  get name() { return "ghcr"; }

  detect(entry) {
    return entry.ecosystem === "ghcr";
  }

  async audit(entry, ctx) {
    const tags = ctx.tags.get(entry.repo) ?? [];
    const releases = ctx.releases.get(entry.repo) ?? [];
    const versions = this.#fetchVersions(entry.repo, entry.name);

    if (!versions) {
      return {
        version: "?",
        findings: [{ severity: "RED", code: "ghcr-unreachable", msg: `Cannot reach ${entry.name} on ghcr.io` }],
      };
    }

    if (versions.length === 0) {
      return {
        version: "?",
        findings: [{ severity: "RED", code: "ghcr-no-versions", msg: `${entry.name} has no versions on ghcr.io` }],
      };
    }

    // API returns newest first — extract the latest tagged version
    const latest = versions[0];
    const containerTags = latest?.metadata?.container?.tags ?? [];
    const version = containerTags.find(t => /^\d/.test(t)) ?? containerTags[0] ?? "?";
    const findings = this.#classify(entry, version, tags, releases);

    return { version, findings };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #fetchVersions(repo, pkg) {
    const owner = repo.split("/")[0];

    // Try org-level endpoint first
    try {
      const endpoint = `/orgs/${owner}/packages/container/${encodeURIComponent(pkg)}/versions`;
      const { stdout, exitCode } = execArgs("gh", ["api", endpoint, "--jq", "."], { timeout: 15_000 });
      if (exitCode === 0) return JSON.parse(stdout);
    } catch { /* fall through */ }

    // Fall back to user-level endpoint
    try {
      const endpoint = `/users/${owner}/packages/container/${encodeURIComponent(pkg)}/versions`;
      const { stdout, exitCode } = execArgs("gh", ["api", endpoint, "--jq", "."], { timeout: 15_000 });
      if (exitCode === 0) return JSON.parse(stdout);
    } catch { /* ignore */ }

    return null;
  }

  #classify(entry, version, tags, releases) {
    const findings = [];

    if (version === "?") return findings;

    const tagName = `v${version}`;

    // Image exists but no matching git tag (RED)
    if (!tags.includes(tagName)) {
      findings.push({
        severity: "RED",
        code: "published-not-tagged",
        msg: `${entry.name} image tagged ${version} — no git tag ${tagName}`,
      });
    }

    // Tagged-but-not-released (YELLOW for front-door)
    if (tags.includes(tagName) && !releases.includes(tagName) && entry.audience === "front-door") {
      findings.push({
        severity: "YELLOW",
        code: "tagged-not-released",
        msg: `${entry.name} tag ${tagName} has no GitHub Release`,
      });
    }

    return findings;
  }

  receipt(result) {
    const [owner, name] = result.repo.split("/");
    return {
      schemaVersion: "1.0.0",
      repo: { owner, name },
      target: "ghcr",
      version: result.version,
      packageName: result.name,
      commitSha: result.commitSha,
      timestamp: new Date().toISOString(),
      artifacts: result.artifacts ?? [],
    };
  }
}
