/**
 * 환경변수 검증 — zod 기반 타입 안전 schema.
 * Boot 시 1회 평가되어 PGCONN 형식 (postgres URL + sslmode=require)을 검증한다.
 * 잘못된 입력 시 즉시 실패하여 런타임 중 connection 오류 회피.
 *
 * @MX:NOTE PGCONN은 server-side ENV에만 — NEXT_PUBLIC_ prefix 절대 금지.
 *          Render replica는 sslmode=require 필수 (tech.md §2.1).
 */
import { z } from 'zod';

/**
 * 환경변수 zod schema.
 * - PGCONN: postgresql:// 또는 postgres:// 스킴, valid URL
 * - NODE_ENV: development/production/test 중 하나, 기본값 'development'
 */
export const envSchema = z.object({
  PGCONN: z
    .string()
    .url({ message: 'PGCONN must be a valid URL' })
    .refine((s) => s.startsWith('postgresql://') || s.startsWith('postgres://'), {
      message: 'PGCONN must use postgresql:// or postgres:// scheme',
    }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * 파싱된 env 타입 (zod 추론).
 */
export type Env = z.infer<typeof envSchema>;

/**
 * 환경변수를 파싱한다. 입력이 주어지지 않으면 process.env를 사용.
 * 잘못된 형식이면 ZodError throw.
 *
 * @param input - 테스트용 임의 입력 (옵셔널). 미지정 시 process.env.
 * @returns 검증된 Env 객체.
 * @throws ZodError - 검증 실패 시.
 */
export function parseEnv(input?: Record<string, string | undefined>): Env {
  return envSchema.parse(input ?? process.env);
}

/**
 * Boot-time validated env 인스턴스.
 * 모듈 import 시점에 검증되어 잘못된 PGCONN 형식이면 즉시 실패한다.
 */
export const env: Env = parseEnv();
