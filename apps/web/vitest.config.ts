import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Vitest 설정 — 단위/통합 테스트.
// .ts 파일은 Node 환경, .tsx (React 컴포넌트) 파일은 jsdom 환경에서 실행.
// e2e는 Playwright이 별도 (playwright.config.ts) 처리.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    // React 컴포넌트 테스트는 jsdom 환경 필요 — Phase 3 REQ-004 entity profile UI.
    environmentMatchGlobs: [['tests/unit/**/*.test.tsx', 'jsdom']],
    // jsdom 환경에서는 DOM 자동 cleanup setup 적용. Node 테스트는 영향 없음.
    setupFiles: ['tests/setup-dom-conditional.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts', 'lib/**/types.ts'],
      thresholds: {
        // SPEC-RHI-001 Phase 5 결정 (2026-04-28): 1주 Solo Hackathon MVP 일정 +
        // UI 컴포넌트 (header, search-box, loop-graph, lib/ranking/lens.ts)는
        // integration/E2E test로 간접 검증되며 unit test 가성비 낮음. 모든 12 AC PASS.
        // .moai/config/sections/quality.yaml `test_coverage_target: 75`와 일치.
        lines: 75,
        branches: 70,
        functions: 75,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
