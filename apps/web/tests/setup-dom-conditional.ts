/**
 * 조건부 jsdom setup — `setupFiles`로 모든 테스트에 로드되지만
 * jsdom 환경에서만 React Testing Library cleanup을 활성화한다.
 *
 * Node 환경 (lens 통합 테스트 등)에서는 window가 존재하지 않으므로
 * import는 동적으로 수행되고 실패 시 silent skip.
 */
import { afterEach } from 'vitest';

// jsdom 환경 감지 — typeof window !== 'undefined'
if (typeof window !== 'undefined') {
  // 동적 import로 jsdom 전용 라이브러리를 Node 환경에서 로드 회피
  void import('@testing-library/jest-dom/vitest');
  void import('@testing-library/react').then(({ cleanup }) => {
    afterEach(() => {
      cleanup();
    });
  });
}
