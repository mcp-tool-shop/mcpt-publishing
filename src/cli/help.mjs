/**
 * Help text for the mcpt-publishing CLI.
 */

export const GLOBAL_HELP = `
mcpt-publishing — Publishing health auditor and receipt factory plugin.

Usage:
  mcpt-publishing <command> [flags]

Commands:
  audit       Run publishing health audit across all registries
  init        Scaffold publishing.config.json and starter manifest
  plan        Dry-run publish plan (shows what would happen)
  publish     Execute publish and generate receipts
  providers   List registered providers and their status

Global flags:
  --help      Show help for a command
  --version   Show version
  --json      Machine-readable output (supported by all commands)

Examples:
  mcpt-publishing audit              # audit all packages, write reports
  mcpt-publishing audit --json       # JSON output to stdout
  mcpt-publishing init               # scaffold config in current directory
  mcpt-publishing providers          # list available providers

Environment:
  PUBLISHING_CONFIG   Path to publishing.config.json (overrides walk-up discovery)
  GH_TOKEN            GitHub token for API access (tags, releases, issues)

Docs: https://github.com/mcp-tool-shop/mcpt-publishing
`.trim();
