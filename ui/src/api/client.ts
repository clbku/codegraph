import type {
  StatsResponse,
  SearchHit,
  SymbolDetailResponse,
  TraceResponse,
} from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
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
};
