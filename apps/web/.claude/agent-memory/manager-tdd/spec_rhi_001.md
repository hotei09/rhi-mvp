---
name: SPEC-RHI-001 layout
description: Non-obvious facts about the SPEC-RHI-001 codebase that future TDD work needs to know
type: project
---

- The Postgres client `apps/web/lib/db/client.ts` enforces a read-only guard. `sql.unsafe(...)` rejects any string starting with INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/TRUNCATE/GRANT/REVOKE. Tests for write paths must mock the client.
- `lib/lenses/concern-score.ts` reads `.moai/project/db/concern-score-weights.yaml` via `node:fs` at module load time. Anything imported into a Client Component (`'use client'`) cannot transitively import this module — it crashes Turbopack with "external modules (request: node:fs)". Inline the constants in client components and add a sync comment.
- BN→entity_id mapping for the multi-source lens lives in `general.entity_source_links` (`source_schema='cra'`, `source_name=<bn>`). Without this lookup the lens always returns the empty fallback.

**Why:** these are the patterns that bit during Phase 3. They are not in CLAUDE.md and would otherwise be rediscovered by reading errors.

**How to apply:** before writing a new lens or a new client component that touches scoring, check these three constraints first.
