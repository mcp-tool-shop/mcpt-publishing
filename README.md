# mcpt-publishing

Publishing profiles, audit reports, and registry truth for MCP Tool Shop packages.

## What This Is

`mcpt-publishing` is the single source of truth for:

- **Profiles** — per-repo declarations of what gets published, where, and how
- **Audit reports** — automated drift detection across npm, NuGet, and GitHub
- **Schemas** — machine-readable contracts for profiles and reports

## Structure

```
profiles/        # One JSON file per shipping repo
schemas/         # JSON Schema for profiles and reports
scripts/         # Audit and reporting tools
reports/         # Generated audit output (Phase 1+)
docs/            # Contracts and decisions
```

## Registry Truth Policy

Published registry versions (npm/NuGet) are treated as **immutable reality**.
Git tags, GitHub Releases, and source version fields are reconciled to match
the registry — never the other way around.

## Phases

| Phase | Goal | Status |
|-------|------|--------|
| 0 | Inventory + audit + report | **current** |
| 1 | Automated drift detection + tag reconciliation | planned |
| 2 | Storefront hygiene (icons, READMEs, metadata) | planned |

## License

MIT
