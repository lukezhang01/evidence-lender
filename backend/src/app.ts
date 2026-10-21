import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiError } from './contract.ts';
import type { Store } from './store.ts';

type Handler = (params: Record<string, string>) => unknown | undefined;

interface Route {
  pattern: RegExp;
  handler: Handler;
}

// Read-only for now. Writes (decisions) arrive with the decision panel in step 4.
export function createRequestHandler(store: Store) {
  const routes: Route[] = [
    { pattern: /^\/api\/config$/, handler: () => store.getConfig() },
    { pattern: /^\/api\/me$/, handler: () => store.getCurrentReviewer() },
    { pattern: /^\/api\/applications$/, handler: () => store.listApplications() },
    { pattern: /^\/api\/applications\/(?<id>[^/]+)$/, handler: (p) => store.getApplication(p.id!) },
    {
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/suggestion$/,
      handler: (p) => store.getSuggestion(p.id!),
    },
    {
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/decisions$/,
      handler: (p) => (store.getApplication(p.id!) ? store.listDecisions(p.id!) : undefined),
    },
    {
      pattern: /^\/api\/evidence-records\/(?<id>[^/]+)$/,
      handler: (p) => store.getEvidenceRecord(p.id!),
    },
  ];

  return function handle(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const route = routes.find((r) => r.pattern.test(path));

    if (!route) return sendError(res, 404, 'not_found', `No route for ${path}`);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return sendError(res, 405, 'method_not_allowed', `${req.method} is not supported on ${path}`);
    }

    try {
      const params = Object.fromEntries(
        Object.entries(route.pattern.exec(path)?.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]),
      );
      const body = route.handler(params);
      if (body === undefined) return sendError(res, 404, 'not_found', `Nothing found at ${path}`);
      return sendJson(res, 200, body);
    } catch (err) {
      console.error(err);
      return sendError(res, 500, 'internal', 'Internal error');
    }
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, code: ApiError['error']['code'], message: string) {
  const body: ApiError = { error: { code, message } };
  sendJson(res, status, body);
}
