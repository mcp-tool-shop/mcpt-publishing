/**
 * Help text for the mcpt-publishing CLI.
 */

export const GLOBAL_HELP = `
mcpt-publishing — A human-first publishing house for your repos.

Usage:
  mcpt-publishing <command> [flags]

Commands:
  audit           Run publishing health audit across all registries
  init            Scaffold publishing.config.json and starter manifest
  publish         Publish packages to registries with receipts
  providers       List registered providers and their status
  verify-receipt  Validate a receipt file (schema + integrity)
  plan            Dry-run publish plan [coming soon]

Global flags:
  --help      Show help for a command
  --version   Show version
  --json      Machine-readable output (supported by all commands)

Examples:
  mcpt-publishing audit                          # audit all packages
  mcpt-publishing audit --json                   # JSON output to stdout
  mcpt-publishing publish --target npm --dry-run # dry-run npm publish
  mcpt-publishing verify-receipt receipts/audit/2026-02-17.json
  mcpt-publishing providers                      # list providers + env vars

Environment:
  PUBLISHING_CONFIG   Path to publishing.config.json (overrides walk-up discovery)
  GH_TOKEN            GitHub token for API access (tags, releases, issues)
  NPM_TOKEN           npm publish token (granular, publish rights)
  NUGET_API_KEY       NuGet API key

Docs: https://github.com/mcp-tool-shop/mcpt-publishing
`.trim();
