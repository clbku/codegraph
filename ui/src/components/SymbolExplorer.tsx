import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SearchHit, SymbolDetailResponse } from '../api/types';
import { CodeBlock } from './CodeBlock';

export interface ExploreInitial {
  /** Preselect this symbol (e.g. when navigating in from Routes). */
  symbolId?: string;
  /** Seed the search box. */
  query?: string;
}

export function SymbolExplorer({ initial }: { initial?: ExploreInitial }) {
  const [query, setQuery] = useState(initial?.query ?? '');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SymbolDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Honour the navigation payload exactly once on mount.
  useEffect(() => {
    if (!initial?.symbolId) return;
    setSelectedId(initial.symbolId);
    setLoading(true);
    api.symbol(initial.symbolId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      api.search(trimmed, 40)
        .then((r) => { if (!cancelled) setHits(r); })
        .catch(() => { if (!cancelled) setHits([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const selectHit = useCallback((hit: SearchHit) => {
    setSelectedId(hit.id);
    setLoading(true);
    api.symbol(hit.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="layout">
      <aside className="panel">
        <div className="panel-header">
          <input
            type="text"
            placeholder="Search symbols…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="panel-body">
          {query.trim().length < 2 && (
            <div className="empty">Type at least 2 characters to search across the index.</div>
          )}
          {query.trim().length >= 2 && !searching && hits.length === 0 && (
            <div className="empty">No matches for "{query.trim()}"</div>
          )}
          {hits.map((hit) => (
            <HitRow key={hit.id} hit={hit} active={selectedId === hit.id} onClick={() => selectHit(hit)} />
          ))}
        </div>
      </aside>

      <main className="panel">
        {!detail && !loading && (
          <div className="empty" style={{ marginTop: '15vh' }}>
            <p>Select a symbol on the left to see its definition, callers, and callees.</p>
          </div>
        )}
        {loading && <div className="empty">Loading…</div>}
        {detail && <SymbolDetail detail={detail} onNavigate={selectHit} />}
      </main>
    </div>
  );
}

function HitRow({ hit, active, onClick }: { hit: SearchHit; active: boolean; onClick: () => void }) {
  return (
    <div className={`hit ${active ? 'active' : ''}`} onClick={onClick}>
      <div>
        <span className="kind-badge" data-kind={hit.kind}>{hit.kind}</span>
        <span className="name">{hit.name}</span>
      </div>
      <div className="meta">{hit.filePath}:{hit.startLine}</div>
    </div>
  );
}

function SymbolDetail({
  detail,
  onNavigate,
}: {
  detail: SymbolDetailResponse;
  onNavigate: (hit: SearchHit) => void;
}) {
  const { node, source, callers, callees, ancestors, children } = detail;

  const toHit = (n: SymbolDetailResponse['callers'][0]['node']): SearchHit => ({
    id: n.id,
    name: n.name,
    qualifiedName: n.qualifiedName,
    kind: n.kind,
    filePath: n.filePath,
    startLine: n.startLine,
    endLine: n.endLine,
    language: n.language,
  });

  return (
    <div className="panel-body">
      <div className="detail-page">
        <div className="detail-title">
          <span className="kind-badge" data-kind={node.kind}>{node.kind}</span>
          <span className="name">{node.name}</span>
        </div>
        <div className="detail-location">{node.filePath}:{node.startLine}–{node.endLine}</div>
        {node.signature && <pre className="detail-signature">{node.signature}</pre>}

        {source && (
          <div className="detail-section">
            <h4>Source</h4>
            <CodeBlock
              code={source}
              language={node.language}
              filePath={node.filePath}
              startLine={node.startLine}
            />
          </div>
        )}

        <RelatedList title="Callers" items={callers.map((c) => toHit(c.node))} onNavigate={onNavigate} />
        <RelatedList title="Callees" items={callees.map((c) => toHit(c.node))} onNavigate={onNavigate} />
        <RelatedList title="Contains" items={children.map(toHit)} onNavigate={onNavigate} />
        <RelatedList title="Container chain" items={ancestors.map(toHit)} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function RelatedList({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: SearchHit[];
  onNavigate: (hit: SearchHit) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="detail-section">
      <h4>{title} <span style={{ color: 'var(--fg-subtle)', fontWeight: 400 }}>({items.length})</span></h4>
      {items.map((item) => (
        <HitRow key={item.id} hit={item} active={false} onClick={() => onNavigate(item)} />
      ))}
    </div>
  );
}
