// Mirror of src/ui-server/types.ts — keep manually in sync for now. A future
// step is generating these from the backend file at build time.

export interface NodeT {
  id: string;
  kind: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  signature?: string;
}

export interface EdgeT {
  source: string;
  target: string;
  kind: string;
  line?: number;
  provenance?: 'tree-sitter' | 'scip' | 'heuristic';
  metadata?: Record<string, unknown>;
}

export interface StatsResponse {
  projectRoot: string;
  backend: string;
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  nodesByKind: Record<string, number>;
  edgesByKind: Record<string, number>;
  languages: Record<string, number>;
  synthesizedEdges: number;
}

export interface SearchHit {
  id: string;
  name: string;
  qualifiedName: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  score?: number;
}

export interface SymbolDetailResponse {
  node: NodeT;
  source: string | null;
  callers: Array<{ node: NodeT; edge: EdgeT }>;
  callees: Array<{ node: NodeT; edge: EdgeT }>;
  ancestors: NodeT[];
  children: NodeT[];
}

export interface TraceHop {
  node: NodeT;
  edge: EdgeT | null;
  source: string | null;
  synthesized: {
    by: string;
    via?: string;
    registeredAt?: string;
  } | null;
}

export interface TraceResponse {
  ok: boolean;
  from: string;
  to: string;
  hops: TraceHop[];
  destinationCallees: Array<{ node: NodeT; source: string | null }>;
  message?: string;
}

export interface RouteHandlerRef {
  id: string;
  name: string;
  qualifiedName: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  via: string;
}

export interface RouteEntry {
  id: string;
  method: string;
  path: string;
  rawName: string;
  framework: string;
  language: string;
  filePath: string;
  startLine: number;
  handler: RouteHandlerRef | null;
  extraHandlers: RouteHandlerRef[];
}

export interface RoutesResponse {
  total: number;
  routes: RouteEntry[];
}
