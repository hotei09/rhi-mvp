/**
 * Methodology 페이지 — REQ-005 Statement A.
 *
 * docs/methodology.md를 빌드 타임에 fs로 읽어 정적 렌더 (Server Component).
 * 마크다운 파서는 외부 의존성 추가 회피 — 단순 split + className으로 구조화.
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement A / AC-10 (director false positive 룰 문서화)
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Header } from '@/components/layout/header';

/**
 * 정적 페이지 — 캐시 매우 길게.
 */
export const revalidate = 3600;
export const runtime = 'nodejs';

/**
 * docs/methodology.md 위치 — 프로젝트 루트 기준.
 */
const METHODOLOGY_PATH = resolve(process.cwd(), '../../docs/methodology.md');

export default async function MethodologyPage(): Promise<React.ReactElement> {
  const content = await readFile(METHODOLOGY_PATH, 'utf8');

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <article className="prose prose-sm max-w-none text-gray-800">
          <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm leading-relaxed">
            {content}
          </pre>
        </article>
      </main>
    </>
  );
}
