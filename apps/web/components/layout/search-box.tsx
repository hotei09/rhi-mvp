'use client';

/**
 * 글로벌 검색 박스 — REQ-005 Statement B / AC-7.
 *
 * Client Component. 입력 → 300ms debounce → /api/search?q=... 호출 → 드롭다운.
 * 결과 클릭 → /entity/[bn] 이동 (bn_root 기반).
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-7
 */
import { useEffect, useState } from 'react';

/**
 * 검색 결과 응답 본문.
 */
type SearchResult = {
  id: number;
  canonical_name: string;
  bn_root: string | null;
  dataset_sources: string[] | null;
  source_count: number | null;
};

/**
 * 검색 박스 — 입력 + debounced fetch + 결과 dropdown.
 */
export function SearchBox(): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 300ms debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const handle = setTimeout(() => {
      setLoading(true);
      void fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : Promise.resolve({ results: [] })))
        .then((data: { results?: SearchResult[] }) => {
          setResults(Array.isArray(data.results) ? data.results : []);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
      <input
        type="search"
        data-testid="global-search-input"
        placeholder="Search by name or BN..."
        aria-label="Search by name or BN"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {open && (
        <div
          data-testid="global-search-results"
          className="absolute z-50 mt-1 max-h-96 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No results</div>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {results.map((r) => {
                const href = r.bn_root ? `/entity/${r.bn_root}RR0001` : '#';
                const sources = Array.isArray(r.dataset_sources)
                  ? r.dataset_sources.join(', ')
                  : '';
                return (
                  <li key={r.id}>
                    <a
                      href={href}
                      className="block px-3 py-2 text-sm hover:bg-gray-50"
                      data-testid="search-result-item"
                    >
                      <div className="font-medium text-gray-900">{r.canonical_name}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {r.bn_root ? `BN ${r.bn_root}` : 'BN unknown'}
                        {sources ? ` · ${sources.toUpperCase()}` : ''}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
