---
name: Vitest dual-env config
description: How apps/web runs Node integration tests and jsdom component tests in one Vitest config
type: project
---

`apps/web/vitest.config.ts` uses `environmentMatchGlobs: [['tests/unit/**/*.test.tsx', 'jsdom']]` to switch environments per file. `setupFiles: ['tests/setup-dom-conditional.ts']` runs for every test, but the setup file checks `typeof window !== 'undefined'` before importing `@testing-library/react` so Node tests are unaffected. React Testing Library `cleanup()` runs in `afterEach` — without it, `screen.getByRole('note')` fails with "multiple elements found" between tests.

**Why:** without conditional setup, importing `@testing-library/react` in a Node-environment test file causes "document is not defined" errors. The `environmentMatchGlobs` + conditional setup keeps both worlds working.

**How to apply:** add new `.test.tsx` files under `tests/unit/` and they automatically get jsdom + cleanup. Add new `.test.ts` files for Node-side integration testing.
