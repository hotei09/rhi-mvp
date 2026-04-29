/**
 * 테스트용 환경변수 로더.
 * `.env.local`이 존재하면 PGCONN 등 누락된 환경변수를 채워 넣는다.
 * 단위 테스트는 dummy fallback도 허용 (실제 DB 연결은 통합 테스트에서만 필요).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');

try {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    // KEY="value" 또는 KEY=value 패턴 파싱 (간단 구현 — dotenv 의존 회피)
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"(.*?)"|(.*))$/);
    if (match) {
      const key = match[1];
      if (key && !process.env[key]) {
        process.env[key] = match[2] ?? match[3] ?? '';
      }
    }
  }
} catch {
  // .env.local 부재 시 무시 — 단위 테스트는 fallback PGCONN 사용
}

// 단위 테스트용 fallback (PGCONN 미설정 시 모듈 import 자체가 실패하는 것을 방지)
if (!process.env.PGCONN) {
  process.env.PGCONN = 'postgresql://dummy:dummy@localhost:5432/dummy?sslmode=require';
}
