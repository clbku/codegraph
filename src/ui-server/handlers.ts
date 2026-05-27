/**
 * HTTP request handlers for the UI server.
 *
 * Each handler takes a parsed query/body and returns a JSON-serialisable
 * value (or throws a HandlerError with a status code). The transport layer
 * (server.ts) is responsible for routing, status codes, and CORS headers.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { CodeGraph } from '../index';
import type { Edge, Node } from '../types';

import type {
  StatsResponse,
  SearchHit,
  SymbolDetailResponse,
  TraceHop,
  TraceResponse,
} from './types';

export class HandlerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// =============================================================================
// /api/stats
// =============================================================================

export function handleStats(cg: CodeGraph): StatsResponse {
  const stats = cg.getStats() as unknown as {
    nodeCount: number;
    edgeCount: number;
    fileCount: number;
    nodesByKind: Record<string, number>;
    edgesByKind: Record<string, number>;
    filesByLanguage: Record<string, number>;
  };

  return {
    projectRoot: cg.getProjectRoot(),
    backend: cg.getBackend?.() ?? 'unknown',
    totalFiles: stats.fileCount,
    totalNodes: stats.nodeCount,
    totalEdges: stats.edgeCount,
    nodesByKind: stats.nodesByKind,
    edgesByKind: stats.edgesByKind,
    languages: stats.filesByLanguage,
    // Synthesized edge count isn't surfaced by getStats — placeholder until
    // the DB exposes it directly. Not load-bearing for the UI.
    synthesizedEdges: 0,
  };
}

// =============================================================================
// /api/search?q=...&limit=...
// =============================================================================

export function handleSearch(cg: CodeGraph, query: string, limit = 30): SearchHit[] {
  if (!query || query.trim().length === 0) return [];
  const raw = cg.searchNodes(query, { limit });
  return raw.map((r) => {
    const n = (r as unknown as { node: Node; score?: number }).node ?? (r as unknown as Node);
    const score = (r as unknown as { score?: number }).score;
    return {
      id: n.id,
      name: n.name,
      qualifiedName: n.qualifiedName,
      kind: n.kind,
      filePath: n.filePath,
      startLine: n.startLine,
      endLine: n.endLine,
      language: n.language,
      score,
    };
  });
}

// =============================================================================
// /api/symbol/:id
// =============================================================================

export function handleSymbol(cg: CodeGraph, id: string): SymbolDetailResponse {
  const node = cg.getNode(id);
  if (!node) throw new HandlerError(404, `Symbol ${id} not found`);

  const source = readSource(cg.getProjectRoot(), node);
  const callers = cg.getCallers(id, 1);
  const callees = cg.getCallees(id, 1);
  const ancestors = cg.getAncestors(id);
  const children = cg.getChildren(id);

  return { node, source, callers, callees, ancestors, children };
}

// =============================================================================
// /api/trace?from=...&to=...
// =============================================================================

export function handleTrace(cg: CodeGraph, fromName: string, toName: string): TraceResponse {
  if (!fromName || !toName) {
    throw new HandlerError(400, 'Both "from" and "to" query params are required');
  }

  const fromMatches = cg.searchNodes(fromName, { limit: 5 });
  const toMatches = cg.searchNodes(toName, { limit: 5 });

  const fromNodes = extractNodes(fromMatches);
  const toNodes = extractNodes(toMatches);

  if (fromNodes.length === 0) {
    return { ok: false, from: fromName, to: toName, hops: [], destinationCallees: [], message: `"${fromName}" not found` };
  }
  if (toNodes.length === 0) {
    return { ok: false, from: fromName, to: toName, hops: [], destinationCallees: [], message: `"${toName}" not found` };
  }

  const MAX_HOPS = 7;
  const edgeKinds: Edge['kind'][] = ['calls'];

  let path: Array<{ node: Node; edge: Edge | null }> | null = null;
  for (const f of fromNodes.slice(0, 3)) {
    for (const t of toNodes.slice(0, 3)) {
      const p = cg.findPath(f.id, t.id, edgeKinds);
      if (p && p.length > 1 && p.length <= MAX_HOPS) { path = p; break; }
    }
    if (path) break;
  }

  if (!path) {
    return {
      ok: false,
      from: fromName,
      to: toName,
      hops: [],
      destinationCallees: [],
      message:
        'No direct call path within 7 hops. The chain likely breaks at dynamic dispatch ' +
        '(callback, descriptor, reflection) which static parsing cannot resolve.',
    };
  }

  const projectRoot = cg.getProjectRoot();
  const hops: TraceHop[] = path.map((step) => ({
    node: step.node,
    edge: step.edge,
    source: readSource(projectRoot, step.node),
    synthesized: synthEdgeNote(step.edge),
  }));

  const dest = path[path.length - 1]!.node;
  const destCallees = cg.getCallees(dest.id, 1)
    .filter((c) => !path!.some((p) => p.node.id === c.node.id))
    .slice(0, 6)
    .map((c) => ({ node: c.node, source: readSource(projectRoot, c.node) }));

  return {
    ok: true,
    from: fromName,
    to: toName,
    hops,
    destinationCallees: destCallees,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function extractNodes(results: unknown[]): Node[] {
  return results.map((r) => {
    const obj = r as { node?: Node } & Node;
    return obj.node ?? obj;
  }).filter((n): n is Node => !!n && typeof n.id === 'string');
}

const sourceCache = new Map<string, string[]>();

function readSource(projectRoot: string, node: Node): string | null {
  try {
    const fullPath = path.isAbsolute(node.filePath)
      ? node.filePath
      : path.join(projectRoot, node.filePath);
    let lines = sourceCache.get(fullPath);
    if (!lines) {
      if (!fs.existsSync(fullPath)) return null;
      lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
      // Cap cache to avoid unbounded growth.
      if (sourceCache.size > 200) {
        const firstKey = sourceCache.keys().next().value;
        if (firstKey !== undefined) sourceCache.delete(firstKey);
      }
      sourceCache.set(fullPath, lines);
    }
    const start = Math.max(0, node.startLine - 1);
    const end = Math.min(lines.length, node.endLine);
    return lines.slice(start, end).join('\n');
  } catch {
    return null;
  }
}

function synthEdgeNote(edge: Edge | null): TraceHop['synthesized'] {
  if (!edge || edge.provenance !== 'heuristic') return null;
  const m = (edge.metadata ?? {}) as Record<string, unknown>;
  return {
    by: String(m.synthesizedBy ?? 'unknown'),
    via: typeof m.via === 'string' ? m.via : undefined,
    registeredAt: typeof m.registeredAt === 'string' ? m.registeredAt : undefined,
  };
}

// Invalidate the source cache (e.g., when files change). Not wired to the
// watcher yet — UI is read-only and re-bake-driven for the MVP.
export function clearSourceCache(): void {
  sourceCache.clear();
}
