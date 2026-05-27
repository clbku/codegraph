import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { RouteEntry, RoutesResponse } from '../api/types';
import { useNavigation } from '../shell/navigation';

// Order methods by HTTP-verb familiarity, then alpha. '' bucket is for routes
// the framework doesn't carry a method on (React Router, SvelteKit, etc.).
const METHOD_ORDER = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY', 'ALL', 'USE', 'RESOURCE', 'VIEWSET'];

export function RoutesView() {
  const [data, setData] = useState<RoutesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [method, setMethod] = useState<string>('all');
  const [framework, setFramework] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.routes()
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const methods = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set(data.routes.map((r) => r.method));
    return Array.from(set).sort((a, b) => {
      const ia = METHOD_ORDER.indexOf(a);
      const ib = METHOD_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [data]);

  const frameworks = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.routes.map((r) => r.framework))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as RouteEntry[];
    const q = filter.trim().toLowerCase();
    return data.routes.filter((r) => {
      if (method !== 'all' && r.method !== method) return false;
      if (framework !== 'all' && r.framework !== framework) return false;
      if (!q) return true;
      return (
        r.path.toLowerCase().includes(q) ||
        r.filePath.toLowerCase().includes(q) ||
        (r.handler?.name.toLowerCase().includes(q) ?? false) ||
        r.rawName.toLowerCase().includes(q)
      );
    });
  }, [data, filter, method, framework]);

  if (loading) return <div className="empty">Loading routes…</div>;
  if (error) return <div className="empty"><span className="status-item warn">{error}</span></div>;
  if (!data || data.total === 0) {
    return (
      <div className="empty" style={{ marginTop: '15vh' }}>
        <p>No routes detected in this project.</p>
        <p style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>
          Routes are emitted by framework resolvers (Express, Laravel, Rails, FastAPI, Spring, …).
          If your project uses one of these, re-run <code>codegraph index</code> to populate them.
        </p>
      </div>
    );
  }

  return (
    <div className="routes-pane">
      <div className="routes-toolbar">
        <input
          type="text"
          placeholder="Filter by path, file or handler…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="HTTP method">
          <option value="all">All methods</option>
          {methods.map((m) => (
            <option key={m || '_none'} value={m}>{m || '— (no method)'}</option>
          ))}
        </select>
        <select value={framework} onChange={(e) => setFramework(e.target.value)} aria-label="Framework">
          <option value="all">All frameworks</option>
          {frameworks.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <span className="routes-count">
          {filtered.length} / {data.total} route{data.total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="routes-table-wrapper">
        <table className="routes-table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Method</th>
              <th>Path</th>
              <th>Handler</th>
              <th>Framework</th>
              <th>Location</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => <RouteRow key={r.id} route={r} />)}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="empty" style={{ padding: '40px 0' }}>No routes match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RouteRow({ route }: { route: RouteEntry }) {
  const { navigate } = useNavigation();
  const handler = route.handler;

  const goExploreHandler = () => {
    if (!handler) return;
    navigate({ to: 'explore', payload: { symbolId: handler.id } });
  };

  const goExploreRoute = () => {
    // Useful even when handler is null — the route node itself has source.
    navigate({ to: 'explore', payload: { symbolId: route.id } });
  };

  const goTraceFromHandler = () => {
    if (!handler) return;
    navigate({ to: 'trace', payload: { from: handler.name } });
  };

  const noHandlerHint =
    'Trace needs a resolved handler symbol. This route does not link to a named function — '
    + 'common for inline anonymous handlers or routes declared inside test fixtures.';

  return (
    <tr className="route-row">
      <td>
        <span className={`method-badge method-${(route.method || 'none').toLowerCase()}`}>
          {route.method || '—'}
        </span>
      </td>
      <td>
        <button
          type="button"
          className="link-button route-path"
          onClick={goExploreRoute}
          title="Open this route's source in Explore"
        >
          {route.path}
        </button>
        {route.rawName !== route.path && route.rawName !== `${route.method} ${route.path}` && (
          <div className="route-raw">{route.rawName}</div>
        )}
      </td>
      <td>
        {handler ? (
          <div>
            <button type="button" className="link-button" onClick={goExploreHandler} title="Open in Explore">
              {handler.name}
            </button>
            {route.extraHandlers.length > 0 && (
              <span className="route-extra"> +{route.extraHandlers.length} more</span>
            )}
            <div className="route-meta">{handler.filePath}:{handler.startLine} · via {handler.via}</div>
          </div>
        ) : (
          <span className="route-meta" title={noHandlerHint}>no handler resolved</span>
        )}
      </td>
      <td><span className="framework-pill">{route.framework}</span></td>
      <td className="route-meta">{route.filePath}:{route.startLine}</td>
      <td>
        <div className="route-actions">
          <button
            type="button"
            className="link-button"
            onClick={goTraceFromHandler}
            disabled={!handler}
            title={handler ? 'Start a trace from this handler' : noHandlerHint}
          >
            Trace →
          </button>
        </div>
      </td>
    </tr>
  );
}
