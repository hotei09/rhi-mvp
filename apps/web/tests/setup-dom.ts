/**
 * 단위 테스트 setup — jsdom 환경 (component 테스트용).
 *
 * vitest.config.ts의 environmentMatchGlobs로 .tsx 테스트 파일에 적용된다.
 * 각 it() 종료 후 React Testing Library의 DOM 트리를 자동 정리해 테스트 간 격리를 보장한다.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
