/**
 * PyPI provider — audits Python packages on pypi.org.
 *
 * Uses the PyPI JSON API: https://pypi.org/pypi/<pkg>/json
 */

import { execSync } from "node:child_process";
import { Provider } from "../provider.mjs";

export default class PyPIProvider extends Provider {
  get name() { return "pypi"; }

  detect(entry) {
    return entry.ecosystem === "pypi";
  }

  async audit(entry, ctx) {
    const meta = this.#fetchMeta(entry.name);
    const tags = ctx.tags.get(entry.repo) ?? [];
    const releases = ctx.releases.get(entry.repo) ?? [];

    if (!meta) {
      return {
        version: "?",
        findings: [{ severity: "RED", code: "pypi-unreachable", msg: `Cannot reach ${entry.name} on PyPI` }],
      };
    }

    const version = meta.info?.version ?? "?";
    const findings = this.#classify(entry, meta, version, tags, releases);
    return { version, findings };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #fetchMeta(pkg) {
    try {
      const url = `https://pypi.org/pypi/${pkg}/json`;
      const raw = execSync(`curl -sf "${url}"`, { encoding: "utf8", timeout: 15_000 });
      return JSON.parse(raw);
    } catch { return null; }
  }

  #classify(entry, meta, version, tags, releases) {
    const findings = [];
    const tagName = `v${version}`;

    // Published-but-not-tagged (RED)
    if (!tags.includes(tagName)) {
      findings.push({
        severity: "RED",
        code: "published-not-tagged",
        msg: `${entry.name}@${version} — no git tag ${tagName}`,
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

    // Description / summary
    const summary = meta.info?.summary ?? "";
    if (!summary) {
      findings.push({
        severity: entry.audience === "front-door" ? "YELLOW" : "GRAY",
        code: "missing-description",
        msg: `${entry.name} has no summary on PyPI`,
      });
    }

    // Homepage / project URL
    const projectUrl = meta.info?.home_page || meta.info?.project_urls?.Homepage || "";
    if (!projectUrl) {
      findings.push({
        severity: "GRAY",
        code: "missing-homepage",
        msg: `${entry.name} has no homepage on PyPI`,
      });
    }

    return findings;
  }

  receipt(result) {
    const [owner, name] = result.repo.split("/");
    return {
      schemaVersion: "1.0.0",
      repo: { owner, name },
      target: "pypi",
      version: result.version,
      packageName: result.name,
      commitSha: result.commitSha,
      timestamp: new Date().toISOString(),
      artifacts: result.artifacts ?? [],
    };
  }
}
