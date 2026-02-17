/**
 * Build an assets receipt object (core writes it via receipt-writer).
 *
 * @param {object} result
 * @param {string} result.repo       — "owner/name"
 * @param {object} result.icon       — { path, sha256, size }
 * @param {object} result.logo       — { path, sha256, size }
 * @param {Array}  result.wireChanges — from wire()
 * @returns {object} assets receipt
 */
export function buildAssetsReceipt(result) {
  const [owner, name] = (result.repo ?? "unknown/unknown").split("/");

  return {
    schemaVersion: "1.0.0",
    type: "assets",
    timestamp: new Date().toISOString(),
    repo: { owner, name },
    artifacts: [
      result.icon
        ? { name: "icon.png", sha256: result.icon.sha256, size: result.icon.size }
        : null,
      result.logo
        ? { name: "logo.png", sha256: result.logo.sha256, size: result.logo.size }
        : null,
    ].filter(Boolean),
    wireChanges: result.wireChanges ?? [],
  };
}
