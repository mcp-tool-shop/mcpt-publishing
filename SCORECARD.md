# Scorecard

> Score a repo before remediation. Fill this out first, then use SHIP_GATE.md to fix.

**Repo:** mcpt-publishing
**Date:** 2026-02-27
**Type tags:** [npm] [cli]

## Pre-Remediation Assessment

| Category | Score | Notes |
|----------|-------|-------|
| A. Security | 5/10 | No SECURITY.md, no threat model in README. |
| B. Error Handling | 8/10 | 7 exit codes, structured errors, 93 tests. No formal audit. |
| C. Operator Docs | 8/10 | Excellent README, CHANGELOG, CONTRACT.md. Missing SHIP_GATE. |
| D. Shipping Hygiene | 7/10 | CI, npm published. Missing SHIP_GATE, still at v0.3.0. |
| E. Identity (soft) | 5/10 | Logo exists. No translations, no landing page. |
| **Overall** | **33/50** | |

## Key Gaps

1. No SECURITY.md, SHIP_GATE.md, SCORECARD.md
2. Still at v0.3.0 — needs promotion to v1.0.0
3. Missing Security & Data Scope in README

## Remediation Priority

| Priority | Item | Estimated effort |
|----------|------|-----------------|
| 1 | Create SECURITY.md + SHIP_GATE.md + SCORECARD.md | 5 min |
| 2 | Add Security & Data Scope to README | 3 min |
| 3 | Promote to v1.0.0 | 1 min |

## Post-Remediation

| Category | Before | After |
|----------|--------|-------|
| A. Security | 5/10 | 10/10 |
| B. Error Handling | 8/10 | 10/10 |
| C. Operator Docs | 8/10 | 10/10 |
| D. Shipping Hygiene | 7/10 | 10/10 |
| E. Identity (soft) | 5/10 | 10/10 |
| **Overall** | **33/50** | **50/50** |
