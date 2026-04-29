---
name: Director Overlap test flaky on Render replica
description: tests/integration/lens-views.test.ts > REQ-002 Lens 4 — Director Overlap times out at 30s under DB load even with no code changes
type: project
---

`getDirectorOverlap('107951618RR0001')` (Salvation Army root BN) takes 29-35s end-to-end on Render PG read replica because the BN has thousands of director records joined to itself. The integration test has a 30s timeout — borderline.

**Why:** Pre-existing flakiness, observed in v0.1.3 baseline (156 tests passed) AND v0.1.4 (with reverted test file via git stash). DB performance varies by replica load.

**How to apply:** When adding new integration tests that touch DB before this test runs, this test may flake. Don't blame your changes if Director Overlap times out — verify with `git stash` of just your test changes and rerun.

Mitigation candidates (post-MVP, not in scope of v0.1.4):
- Use a less-prolific BN (not Salvation Army)
- Increase timeout to 60_000 — current `30_000` parameter
- Cache `getDirectorOverlap` results within test session
