---
name: SPEC-RHI-001 v0.1.4 patterns insufficient for ALL health bodies
description: %Health Sciences% (HAMILTON HEALTH SCIENCES, LONDON HEALTH SCIENCES) and CHU/UNIVERSITY hospitals not caught by current 12 patterns
type: project
---

v0.1.4 added 6 new patterns: %Hospital% / %Hopital% / %Health Services% / %Santé% / %Centre Intégré% / %Shared Health%. v2 sample-entities extraction shows zombie top 5 still has health-body false positives:

1. HAMILTON HEALTH SCIENCES CORPORATION — has "Sciences" not "Services", needs `%Health Sciences%`
2. CHU de Québec - Université Laval — French CHU acronym not caught
3. UNIVERSITY OF BRITISH COLUMBIA — university public body
4. CANADIAN BLOOD SERVICES — federal Crown corp, "%Crown Corporation%" wouldn't match this name
5. LONDON HEALTH SCIENCES CENTRE — "Sciences" again

**Why:** Phase 5 task brief explicitly listed exactly 6 new patterns. Adding more was out of scope. User to decide whether v0.1.5 should add `%Health Sciences%` / `%CHU %` / `% University` / `% Blood Services%` etc.

**How to apply:** When user requests v0.1.5 health body refinement, propose the above patterns first. Do NOT auto-add — false positive risk on legitimate medical research charities (e.g., charities containing "Blood" or "Sciences" that are NOT government bodies).
