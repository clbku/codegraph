/**
 * Local UI server for CodeGraph.
 *
 * Zero-dependency HTTP server built on Node's `http` module — keeps the npm
 * package light. Serves:
 *
 *   GET  /api/stats                    — index health, counts, languages
 *   GET  /api/search?q=&limit=         — FTS search → SearchHit[]
 *   GET  /api/symbol/:id               — full symbol detail + source + neighbours
 *   GET  /api/trace?from=&to=          — shortest call path between two symbols
 *   GET  /api/routes                   — HTTP routes detected by framework resolvers
 *
 * Plus static files from `staticDir` (the bundled frontend) when provided.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

import type { CodeGraph } from '../index';
import {
  handleStats,
  handleSearch,
  handleSymbol,
  handleTrace,
  handleRoutes,
  HandlerError,
} from './handlers';
import type { ServerOptions } from './types';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export interface UIServerHandle {
  url: string;
  close: () => Promise<void>;
}

export async function startUIServer(
  cg: CodeGraph,
  options: ServerOptions,
): Promise<UIServerHandle> {
  const server = http.createServer((req, res) => {
    handleRequest(cg, options, req, res).catch((err) => {
      const status = err instanceof HandlerError ? err.status : 500;
      const message = err instanceof Error ? err.message : String(err);
      sendJSON(res, status, { error: message });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const url = `http://${options.host === '0.0.0.0' ? 'localhost' : options.host}:${options.port}`;
  return {
    url,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}

async function handleRequest(
  cg: CodeGraph,
  options: ServerOptions,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  // CORS — UI is loopback-only, but during `vite dev` the frontend runs on
  // 5173 and proxies are a pain to configure for the user.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  // API routes
  if (pathname === '/api/stats') {
    sendJSON(res, 200, handleStats(cg));
    return;
  }

  if (pathname === '/api/search') {
    const q = url.searchParams.get('q') ?? '';
    const limit = parseInt(url.searchParams.get('limit') ?? '30', 10);
    sendJSON(res, 200, handleSearch(cg, q, Number.isFinite(limit) ? limit : 30));
    return;
  }

  if (pathname.startsWith('/api/symbol/')) {
    const id = decodeURIComponent(pathname.slice('/api/symbol/'.length));
    sendJSON(res, 200, handleSymbol(cg, id));
    return;
  }

  if (pathname === '/api/trace') {
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    sendJSON(res, 200, handleTrace(cg, from, to));
    return;
  }

  if (pathname === '/api/routes') {
    sendJSON(res, 200, handleRoutes(cg));
    return;
  }

  // Anything under /api/ that didn't match above is a missing endpoint, NOT a
  // SPA route. Returning index.html here would make `fetch('/api/x').then(r=>r.json())`
  // try to parse HTML and throw a confusing "string did not match the expected
  // pattern" error in the browser instead of a clean 404.
  if (pathname.startsWith('/api/')) {
    sendJSON(res, 404, { error: `Unknown API endpoint: ${pathname}` });
    return;
  }

  // Static frontend
  if (options.staticDir) {
    await serveStatic(options.staticDir, pathname, res);
    return;
  }

  sendJSON(res, 404, { error: `Unknown route: ${pathname}` });
}

async function serveStatic(
  staticDir: string,
  pathname: string,
  res: http.ServerResponse,
): Promise<void> {
  // SPA: every unknown route falls through to index.html.
  const relative = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(path.join(staticDir, relative));

  // Defence-in-depth against path traversal.
  if (!resolved.startsWith(path.resolve(staticDir))) {
    sendJSON(res, 403, { error: 'forbidden' });
    return;
  }

  try {
    const stat = await fs.promises.stat(resolved);
    if (stat.isDirectory()) {
      return serveStatic(staticDir, path.join(pathname, 'index.html'), res);
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    fs.createReadStream(resolved).pipe(res);
  } catch {
    // SPA fallback
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': MIME['.html']! });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      sendJSON(res, 404, { error: 'Frontend bundle not found. Run `npm run build:ui` first.' });
    }
  }
}

function sendJSON(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}
