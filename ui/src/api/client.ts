import type {
  StatsResponse,
  SearchHit,
  SymbolDetailResponse,
  TraceResponse,
  RoutesResponse,
} from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  // Guard against a stale backend that falls back to serving index.html for
  // unknown /api/* paths — without this, `res.json()` throws the cryptic
  // "string did not match the expected pattern" instead of a useful error.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON from ${path} but got "${contentType || 'no content-type'}". ` +
      `Is the running codegraph server on the same version as the UI bundle?`,
    );
  }
  return res.json();
}

export const api = {
  stats: () => get<StatsResponse>('/api/stats'),
  search: (q: string, limit = 30) =>
    get<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  symbol: (id: string) =>
    get<SymbolDetailResponse>(`/api/symbol/${encodeURIComponent(id)}`),
  trace: (from: string, to: string) =>
    get<TraceResponse>(
      `/api/trace?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  routes: () => get<RoutesResponse>('/api/routes'),
};
