/**
 * @mcptoolshop/mcpt-publishing-assets
 *
 * Logo, icon, and image asset generation for mcpt-publishing.
 * Uses sharp for all image processing.
 *
 * Exports:
 *   doctor() — verify sharp is installed and working
 *   logo()   — generate icon.png + logo.png from a source image
 *   wire()   — wire generated assets into README / .csproj
 */

export { doctor } from "./lib/doctor.mjs";
export { logo } from "./lib/logo.mjs";
export { wire } from "./lib/wire.mjs";
export { buildAssetsReceipt } from "./lib/receipt.mjs";
