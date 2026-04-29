/**
 * 단위 테스트 — `lib/middleware/rate-limit.ts` 순수 함수 검증.
 *
 * AC-8b: 분당 30 req IP-based threshold, 31번째 → 429, 1분 후 회복.
 * 본 테스트는 `enforceRateLimit` 순수 함수의 결정론적 동작을 검증한다.
 * 실제 미들웨어 통합 동작은 E2E (`tests/e2e/rate-limit.spec.ts`)로 검증한다.
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement C / AC-8b
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitStore,
  enforceRateLimit,
} from '@/lib/middleware/rate-limit';

describe('enforceRateLimit — AC-8b 단위 검증', () => {
  it('first request from fresh IP is allowed', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    const result = enforceRateLimit('1.2.3.4', now, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('30 calls within window are all allowed', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) {
      const r = enforceRateLimit('1.2.3.4', now + i * 10, store, DEFAULT_RATE_LIMIT_CONFIG);
      expect(r.allowed).toBe(true);
    }
  });

  it('31st call within window is denied with retryAfter', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) {
      enforceRateLimit('1.2.3.4', now + i * 10, store, DEFAULT_RATE_LIMIT_CONFIG);
    }
    const r = enforceRateLimit('1.2.3.4', now + 300, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it('after window expires, calls are allowed again from same IP', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) {
      enforceRateLimit('1.2.3.4', now + i * 10, store, DEFAULT_RATE_LIMIT_CONFIG);
    }
    // window: 60_000ms 후
    const afterWindow = now + 60_001;
    const r = enforceRateLimit('1.2.3.4', afterWindow, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(r.allowed).toBe(true);
    expect(r.retryAfter).toBeUndefined();
  });

  it('different IPs have independent counters', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    // IP A — 30 calls
    for (let i = 0; i < 30; i++) {
      enforceRateLimit('1.1.1.1', now + i * 10, store, DEFAULT_RATE_LIMIT_CONFIG);
    }
    // IP A 31st → denied
    const a31 = enforceRateLimit('1.1.1.1', now + 310, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(a31.allowed).toBe(false);
    // IP B — fresh, 1st call → allowed
    const b1 = enforceRateLimit('2.2.2.2', now + 320, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(b1.allowed).toBe(true);
  });

  it('default config: maxRequests=30, windowMs=60_000', () => {
    expect(DEFAULT_RATE_LIMIT_CONFIG.maxRequests).toBe(30);
    expect(DEFAULT_RATE_LIMIT_CONFIG.windowMs).toBe(60_000);
  });

  it('custom config respects custom maxRequests', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    const config = { maxRequests: 5, windowMs: 60_000 };
    for (let i = 0; i < 5; i++) {
      const r = enforceRateLimit('1.2.3.4', now + i, store, config);
      expect(r.allowed).toBe(true);
    }
    const denied = enforceRateLimit('1.2.3.4', now + 100, store, config);
    expect(denied.allowed).toBe(false);
  });

  it('result includes remaining count', () => {
    const store: RateLimitStore = new Map();
    const now = 1_000_000;
    const r1 = enforceRateLimit('1.2.3.4', now, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(r1.remaining).toBe(29);
    const r2 = enforceRateLimit('1.2.3.4', now + 10, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(r2.remaining).toBe(28);
  });

  it('retryAfter is roughly window remaining time when denied', () => {
    const store: RateLimitStore = new Map();
    const start = 1_000_000;
    for (let i = 0; i < 30; i++) {
      enforceRateLimit('1.2.3.4', start + i * 10, store, DEFAULT_RATE_LIMIT_CONFIG);
    }
    // 30 calls 마지막 시점 = start + 290ms. window resetAt = start + 60_000 (첫 call의 resetAt).
    // 31번째 시점 = start + 1000ms → retryAfter ≈ ceil((60_000 - 1000) / 1000) = 59
    const r = enforceRateLimit('1.2.3.4', start + 1000, store, DEFAULT_RATE_LIMIT_CONFIG);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThanOrEqual(58);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });
});
