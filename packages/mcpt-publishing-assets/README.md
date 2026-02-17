<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop/mcpt-publishing/main/packages/mcpt-publishing-assets/logo.png" alt="mcpt-publishing-assets logo" width="420" />
</p>

<h1 align="center">@mcptoolshop/mcpt-publishing-assets</h1>

<p align="center">
  Optional assets plugin for <a href="https://github.com/mcp-tool-shop/mcpt-publishing">mcpt-publishing</a>.<br/>
  Generates logos, icons, and wires them into your repo metadata.
</p>

## Install

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
```

This installs `sharp` as a dependency for image processing.

## Usage

Once installed, `mcpt-publishing` auto-detects the plugin:

```bash
# Check sharp is working
npx mcpt-publishing assets doctor

# Generate icon.png (512x512) + logo.png (1280x640)
npx mcpt-publishing assets logo --input source.png --out ./assets

# Wire assets into README.md and .csproj
npx mcpt-publishing assets wire --repo owner/name
```

## API

```js
import { doctor, logo, wire, buildAssetsReceipt } from "@mcptoolshop/mcpt-publishing-assets";

// Check sharp
const { ok, sharpVersion, errors } = await doctor();

// Generate assets
const result = await logo({ input: "source.png", outDir: "./assets" });
// → { icon: { path, sha256, size }, logo: { path, sha256, size } }

// Wire into project files
const { changes } = await wire({ repo: "owner/name", outDir: "./assets" });

// Build receipt for core to write
const receipt = buildAssetsReceipt({ repo: "owner/name", ...result, wireChanges: changes });
```

## License

MIT
