/**
 * 단위 테스트 — `lib/db/env.ts` zod 스키마 검증.
 * 실제 process.env에 의존하지 않고 envSchema.safeParse로 직접 테스트한다.
 */
import '../setup-env';
import { describe, expect, it } from 'vitest';

describe('lib/db/env — environment schema validation', () => {
  it('valid postgresql:// PGCONN with sslmode=require passes', async () => {
    const { envSchema } = await import('@/lib/db/env');
    const result = envSchema.safeParse({
      PGCONN: 'postgresql://user:pass@host.com:5432/db?sslmode=require',
      NODE_ENV: 'production',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PGCONN).toContain('postgresql://');
    }
  });

  it('valid postgres:// PGCONN passes (alternative scheme)', async () => {
    const { envSchema } = await import('@/lib/db/env');
    const result = envSchema.safeParse({
      PGCONN: 'postgres://user:pass@host:5432/db?sslmode=require',
    });
    expect(result.success).toBe(true);
  });

  it('missing PGCONN fails validation', async () => {
    const { envSchema } = await import('@/lib/db/env');
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('non-postgres scheme (mysql://) fails validation', async () => {
    const { envSchema } = await import('@/lib/db/env');
    const result = envSchema.safeParse({
      PGCONN: 'mysql://user:pass@host:3306/db',
    });
    expect(result.success).toBe(false);
  });

  it('non-URL string fails validation', async () => {
    const { envSchema } = await import('@/lib/db/env');
    const result = envSchema.safeParse({
      PGCONN: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('parseEnv() returns parsed object when process.env is valid', async () => {
    const { parseEnv } = await import('@/lib/db/env');
    const env = parseEnv({
      PGCONN: 'postgresql://u:p@h:5432/d?sslmode=require',
      NODE_ENV: 'test',
    });
    expect(env.PGCONN).toBe('postgresql://u:p@h:5432/d?sslmode=require');
    expect(env.NODE_ENV).toBe('test');
  });

  it('parseEnv() throws on invalid input', async () => {
    const { parseEnv } = await import('@/lib/db/env');
    expect(() => parseEnv({ PGCONN: 'invalid' })).toThrow();
  });
});
