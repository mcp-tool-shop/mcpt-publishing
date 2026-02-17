/**
 * Assets doctor — verify that sharp is installed and working.
 *
 * @returns {{ ok: boolean, sharpVersion: string|null, errors: string[] }}
 */
export async function doctor() {
  const errors = [];
  let sharpVersion = null;

  try {
    const sharp = (await import("sharp")).default;
    const meta = sharp("dummy"); // won't actually read — we just need the constructor
    sharpVersion = sharp.versions?.sharp ?? "unknown";

    // Smoke test: create a tiny 1x1 pixel buffer
    await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND" || e.code === "MODULE_NOT_FOUND") {
      errors.push("sharp is not installed. Run: npm i -D @mcptoolshop/mcpt-publishing-assets");
    } else {
      errors.push(`sharp smoke test failed: ${e.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    sharpVersion,
    errors,
  };
}
