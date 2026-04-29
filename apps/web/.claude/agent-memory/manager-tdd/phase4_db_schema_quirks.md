---
name: Phase 4 DB schema discoveries
description: Surprising column names in vw_entity_search and AB schema differences from queries.md docs
type: project
---

When implementing /api/search and landing ranking in Phase 4 of SPEC-RHI-001:

`general.vw_entity_search` real columns differ from queries.md §10 references:
- queries.md mentions `norm_canonical` and `source_link_count` — neither exists
- Actual columns: `canonical_name` (text), `source_count` (integer)
- For prefix-match use `canonical_name ILIKE` directly (case-insensitive)
- Tiebreaker: `source_count DESC NULLS LAST`

`ab` schema does not have `ab.grants_received` — the actual table is `ab.ab_grants`. Multi-source lens (Phase 2) already uses correct names; new ranking SQL must follow same pattern.

**Why:** queries.md is design-stage pseudo-code; column names need verification against actual deployed schema.

**How to apply:** Before writing SQL against `general.*` or `ab.*` tables, run an `information_schema.columns` query to confirm real column names. Add a temp diag test (delete after) rather than guessing.
