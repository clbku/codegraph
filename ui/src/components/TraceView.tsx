import { useCallback, useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { api } from '../api/client';
import type { TraceResponse } from '../api/types';
import { CodeBlock } from './CodeBlock';

cytoscape.use(dagre);

export function TraceView() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredHopIdx, setHoveredHopIdx] = useState<number | null>(null);

  const runTrace = useCallback(() => {
    if (!from.trim() || !to.trim()) return;
    setLoading(true);
    setError(null);
    api.trace(from.trim(), to.trim())
      .then((r) => {
        setResult(r);
        setHoveredHopIdx(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  const activeIdx = result?.ok ? (hoveredHopIdx ?? 0) : null;
  const activeHop = activeIdx !== null && result ? result.hops[activeIdx] ?? null : null;
  const activeSource = activeHop?.source ?? null;
  const activeLabel = activeHop
    ? `${activeHop.node.name} — ${activeHop.node.filePath}:${activeHop.node.startLine}`
    : null;

  // Lines to highlight inside the active hop's source:
  //  - the outgoing call site to the next hop (edge.line of next hop)
  //  - or, for the destination, the function's signature line (its declaration)
  const highlightLines: number[] = [];
  if (activeHop && activeIdx !== null && result?.ok) {
    const next = result.hops[activeIdx + 1];
    if (next?.edge?.line) {
      highlightLines.push(next.edge.line);
    } else {
      highlightLines.push(activeHop.node.startLine);
    }
  }

  return (
    <div className="trace-pane">
      <div className="trace-toolbar">
        <input
          placeholder="from symbol  (e.g. handleSymbol)"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runTrace()}
        />
        <span className="arrow">→</span>
        <input
          placeholder="to symbol  (e.g. readSource)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runTrace()}
        />
        <button className="primary" onClick={runTrace} disabled={loading || !from.trim() || !to.trim()}>
          {loading ? 'Tracing…' : 'Trace'}
        </button>
      </div>

      <div className="trace-body">
        <div className="cy-container">
          {!result && (
            <div className="empty">
              Enter a source and destination symbol to visualize the call path.
              <br />
              Synthesized edges (callbacks, React re-renders, JSX children) appear dashed in purple.
            </div>
          )}
          {error && <div className="empty"><span className="status-item warn">{error}</span></div>}
          {result && !result.ok && (
            <div className="empty">{result.message ?? 'No path found.'}</div>
          )}
          {result?.ok && (
            <TraceGraph
              result={result}
              onHover={setHoveredHopIdx}
            />
          )}
        </div>

        {activeSource && activeHop ? (
          <div className="source-pane">
            <div className="source-pane-header">
              <span>{activeLabel}</span>
              <span style={{ color: 'var(--fg-subtle)' }}>hop {(activeIdx ?? 0) + 1} / {result?.hops.length}</span>
            </div>
            <CodeBlock
              code={activeSource}
              language={activeHop.node.language}
              filePath={activeHop.node.filePath}
              startLine={activeHop.node.startLine}
              highlightLines={highlightLines}
            />
          </div>
        ) : (
          <div className="source-pane empty-pane">
            {result?.ok ? 'Hover or tap a node to see its source' : 'Source preview will appear here'}
          </div>
        )}
      </div>
    </div>
  );
}

function TraceGraph({
  result,
  onHover,
}: {
  result: TraceResponse;
  onHover: (idx: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const nodes = result.hops.map((hop, idx) => ({
      data: {
        id: `hop-${idx}`,
        label: hop.node.name,
        kind: hop.node.kind,
        meta: `${hop.node.filePath}:${hop.node.startLine}`,
      },
    }));

    const edges = result.hops.slice(1).map((hop, idx) => {
      const synth = hop.synthesized;
      const label = synth
        ? `${synth.by}${synth.via ? ` via ${synth.via}` : ''}`
        : hop.edge?.kind ?? 'calls';
      return {
        data: {
          id: `edge-${idx}`,
          source: `hop-${idx}`,
          target: `hop-${idx + 1}`,
          label,
          synthesized: synth ? 'true' : 'false',
        },
      };
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#161a22',
            color: '#d6deeb',
            'border-width': 1,
            'border-color': '#2f3540',
            'font-family': 'JetBrains Mono, SF Mono, Menlo, monospace',
            'font-size': 12,
            'font-weight': 500,
            shape: 'round-rectangle',
            width: 'label',
            height: 34,
            padding: '12px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#79b8ff',
            'border-width': 2,
            'background-color': '#1d222b',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'edge',
          style: {
            label: 'data(label)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#2f3540',
            'target-arrow-color': '#2f3540',
            'font-size': 10,
            color: '#7a869a',
            'text-background-color': '#0b0d11',
            'text-background-opacity': 1,
            'text-background-padding': '3px',
            'text-rotation': 'autorotate',
            width: 1.6,
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge[synthesized = "true"]',
          style: {
            'line-color': '#c596ff',
            'target-arrow-color': '#c596ff',
            'line-style': 'dashed',
            color: '#c596ff',
            width: 2,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 40,
        rankSep: 60,
      } as cytoscape.LayoutOptions,
    });

    cy.on('mouseover', 'node', (e) => {
      const id = e.target.id() as string;
      const idx = parseInt(id.replace('hop-', ''), 10);
      onHover(Number.isFinite(idx) ? idx : null);
    });
    cy.on('mouseout', 'node', () => onHover(null));
    cy.on('tap', 'node', (e) => {
      const id = e.target.id() as string;
      const idx = parseInt(id.replace('hop-', ''), 10);
      onHover(Number.isFinite(idx) ? idx : null);
    });

    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [result, onHover]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
