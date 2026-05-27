/**
 * Wire-format types shared between the UI HTTP server and the frontend.
 *
 * Keep this file dependency-free — the frontend reimports it (via copy or
 * symlink during the Vite build).
 */

import type { Node, Edge } from '../types';

export interface ServerOptions {
  port: number;
  host: string;
  staticDir: string | null;
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
  node: Node;
  source: string | null;
  callers: Array<{ node: Node; edge: Edge }>;
  callees: Array<{ node: Node; edge: Edge }>;
  ancestors: Node[];
  children: Node[];
}

export interface TraceHop {
  node: Node;
  edge: Edge | null;
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
  destinationCallees: Array<{ node: Node; source: string | null }>;
  message?: string;
}
