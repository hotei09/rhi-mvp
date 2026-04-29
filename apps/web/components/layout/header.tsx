/**
 * 사이트 헤더 — 네비게이션 + 글로벌 검색 박스.
 *
 * Server Component. 검색 박스만 client (search-box.tsx).
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement A (페이지 네비게이션)
 */
import Link from 'next/link';

import { SearchBox } from './search-box';

/**
 * 메인 네비게이션 항목.
 */
const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/lens/zombie', label: 'Zombie' },
  { href: '/lens/ghost', label: 'Ghost' },
  { href: '/lens/loops', label: 'Loops' },
  { href: '/methodology', label: 'Methodology' },
] as const;

/**
 * 사이트 헤더.
 */
export function Header(): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-bold text-gray-900">
            <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-white">
              RHI
            </span>
            <span className="hidden sm:inline">Recipient Health Index</span>
          </Link>
          <nav className="hidden gap-4 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-700 hover:text-blue-600"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex-1 max-w-md">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
