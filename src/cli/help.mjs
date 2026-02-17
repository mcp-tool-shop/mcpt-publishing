/**
 * Help text for the mcpt-publishing CLI.
 */

export const GLOBAL_HELP = `
mcpt-publishing — A human-first publishing house for your repos.

Usage:
  mcpt-publishing <command> [flags]

Commands:
  audit           Run publishing health audit across all registries
  fix             Apply allowlisted metadata fixes (local, --remote, --pr)
  publish         Publish packages to registries with receipts
  weekly          Audit + fix + optionally publish (one command)
  assets          Logo/icon generation and wiring [plugin]
  providers       List registered providers and their status
  verify-receipt  Validate a receipt file (schema + integrity)
  init            Scaffold publishing.config.json and starter manifest
  plan            [deprecated — use fix --dry-run]

Global flags:
  --help      Show help for a command
  --version   Show version
  --json      Machine-readable output (supported by all commands)

Golden path:
  mcpt-publishing audit                           # 1. discover drift
  mcpt-publishing fix --dry-run                   # 2. preview fixes
  mcpt-publishing fix                             # 3. apply fixes locally
  mcpt-publishing publish --target npm --dry-run  # 4. preview publish
  mcpt-publishing publish --target npm            # 5. publish with receipts

  # Or do it all at once:
  mcpt-publishing weekly --dry-run                # preview everything
  mcpt-publishing weekly --publish                # the full pipeline

Environment:
  PUBLISHING_CONFIG   Path to publishing.config.json (overrides walk-up discovery)
  GH_TOKEN            GitHub token for API access (tags, releases, issues)
  NPM_TOKEN           npm publish token (granular, publish rights)
  NUGET_API_KEY       NuGet API key

Docs: https://github.com/mcp-tool-shop/mcpt-publishing
`.trim();
