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
    // ctx.tags and ctx.releases are expected to be pre-resolved Maps whose values
    // are plain string arrays (not Promises). Callers must await all async data
    // collection before constructing ctx and passing it here.
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
    const semverTag = containerTags.find(t => /^\d/.test(t));
    const findings = this.#classify(entry, semverTag ?? "?", tags, releases);

    if (!semverTag) {
      // No semver tag found — fall back to the first available tag (may be a
      // commit SHA or an unversioned label like "latest") but emit a finding so
      // the drift can be surfaced in the JSON report rather than going unnoticed.
      const fallback = containerTags[0] ?? "?";
      findings.push({
        severity: "YELLOW",
        code: "no-semver-tag",
        msg: `${entry.name} has no semver image tag — latest container tag is "${fallback}"`,
      });
      return { version: fallback, findings };
    }

    return { version: semverTag, findings };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #fetchVersions(repo, pkg) {
    const owner = repo.split("/")[0];

    // Try org-level endpoint first
    try {
      const endpoint = `/orgs/${encodeURIComponent(owner)}/packages/container/${encodeURIComponent(pkg)}/versions`;
      const { stdout, exitCode } = execArgs("gh", ["api", endpoint, "--jq", "."], { timeout: 15_000 });
      if (exitCode === 0) return JSON.parse(stdout);
    } catch { /* fall through */ }

    // Fall back to user-level endpoint
    try {
      const endpoint = `/users/${encodeURIComponent(owner)}/packages/container/${encodeURIComponent(pkg)}/versions`;
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
