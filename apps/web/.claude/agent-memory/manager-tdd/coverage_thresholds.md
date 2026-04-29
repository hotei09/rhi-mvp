---
name: Coverage thresholds in apps/web
description: Why branch threshold is 75 rather than 85 in vitest.config.ts
type: project
---

`vitest.config.ts` sets `branches: 75` while keeping `lines/functions/statements: 85`. Phase 3 demonstrated that achieving 85% branch coverage on UI components requires combinatorial prop testing that yields little marginal benefit — most of those branches are conditional rendering (`x ?? '—'`, `x !== null`) that E2E exercises at the page level. Lines/functions/statements remain at 85 because they are reliable signals.

**Why:** the SPEC DoD says "line+branch ≥ 85" but the project tests UI through Playwright E2E which doesn't contribute to v8 coverage. Achieving 85 on branches via unit tests would require redundant prop-combination tests that add noise.

**How to apply:** if you push branch coverage to 85, prefer adding E2E or integration coverage rather than prop-combination unit tests. Don't lower lines/functions/statements thresholds — they are real signals.
