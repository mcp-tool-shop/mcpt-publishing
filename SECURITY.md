# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Scope

mcpt-publishing is a **publishing health auditor and receipt factory** that sits between repos and registries.

- **Data touched:** Package manifests (package.json, .csproj), registry metadata (npm/NuGet/PyPI — read-only API), receipt JSON files (write)
- **Data NOT touched:** No credentials stored, no source code modification, no telemetry
- **Permissions:** Read: package manifests, registry APIs. Write: receipt files to user-specified paths.
- **Network:** Registry APIs (npm, NuGet, PyPI) — read-only queries for version/hash verification
- **Telemetry:** None collected or sent

## Reporting a Vulnerability

Email: **64996768+mcp-tool-shop@users.noreply.github.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Version affected
- Potential impact

### Response timeline

| Action | Target |
|--------|--------|
| Acknowledge report | 48 hours |
| Assess severity | 7 days |
| Release fix | 30 days |
