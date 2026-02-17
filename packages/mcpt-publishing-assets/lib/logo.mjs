/**
 * Logo generator — produce icon.png and logo.png from a source image.
 *
 * icon.png:  512×512, fit inside, transparent background
 * logo.png:  1280×640, source centered on transparent background
 *
 * @param {object} opts
 * @param {string} opts.input   — path to source image
 * @param {string} opts.outDir  — output directory
 * @param {{ icon?: number[], logo?: number[] }} [opts.sizes] — override sizes
 * @returns {Promise<{ icon: AssetInfo, logo: AssetInfo }>}
 *
 * @typedef {{ path: string, sha256: string, size: number }} AssetInfo
 */

import { join } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export async function logo(opts) {
  const sharp = (await import("sharp")).default;
  const { input, outDir, sizes = {} } = opts;

  mkdirSync(outDir, { recursive: true });

  const iconSize = sizes.icon ?? [512, 512];
  const logoSize = sizes.logo ?? [1280, 640];

  // Generate icon.png (512×512)
  const iconPath = join(outDir, "icon.png");
  await sharp(input)
    .resize(iconSize[0], iconSize[1], { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(iconPath);

  const iconInfo = hashAndSize(iconPath);

  // Generate logo.png (1280×640) — source centered on transparent canvas
  const logoPath = join(outDir, "logo.png");
  const resized = await sharp(input)
    .resize(Math.min(logoSize[0] - 80, 800), Math.min(logoSize[1] - 80, 560), {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();

  const left = Math.round((logoSize[0] - resizedMeta.width) / 2);
  const top = Math.round((logoSize[1] - resizedMeta.height) / 2);

  await sharp({
    create: {
      width: logoSize[0],
      height: logoSize[1],
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(logoPath);

  const logoInfo = hashAndSize(logoPath);

  return {
    icon: { path: iconPath, sha256: iconInfo.sha256, size: iconInfo.size },
    logo: { path: logoPath, sha256: logoInfo.sha256, size: logoInfo.size },
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function hashAndSize(filePath) {
  const buf = readFileSync(filePath);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  return { sha256, size: buf.length };
}
