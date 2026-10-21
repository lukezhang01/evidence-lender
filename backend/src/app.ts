import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiError } from './contract.ts';
import { ApiProblem, type Store } from './store.ts';

interface RequestContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

type Handler = (ctx: RequestContext) => unknown;

interface Route {
  method: 'GET' | 'POST';
  pattern: RegExp;
  status?: number;
  handler: Handler;
}

// Room for a statement CSV; the frontend caps uploads well below this.
const MAX_BODY_BYTES = 1024 * 1024;

export function createRequestHandler(store: Store) {
  const id = (ctx: RequestContext) => ctx.params.id!;
  const routes: Route[] = [
    { method: 'GET', pattern: /^\/api\/config$/, handler: () => store.getConfig() },
    { method: 'GET', pattern: /^\/api\/me$/, handler: () => store.getCurrentReviewer() },
    { method: 'GET', pattern: /^\/api\/reviewers$/, handler: () => store.listReviewers() },
    { method: 'GET', pattern: /^\/api\/quote$/, handler: (ctx) => store.quoteAmount(ctx.query.get('amount')) },
    { method: 'GET', pattern: /^\/api\/applications$/, handler: () => store.listApplications() },
    { method: 'POST', pattern: /^\/api\/applications$/, status: 201, handler: (ctx) => store.createApplication(ctx.body) },
    { method: 'GET', pattern: /^\/api\/applications\/(?<id>[^/]+)$/, handler: (ctx) => store.getApplication(id(ctx)) },
    {
      method: 'POST',
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/statement$/,
      status: 201,
      handler: (ctx) => store.uploadStatement(id(ctx), ctx.body),
    },
    {
      method: 'POST',
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/submit$/,
      handler: (ctx) => store.submit(id(ctx), ctx.body),
    },
    {
      method: 'GET',
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/decisions$/,
      handler: (ctx) => store.listDecisions(id(ctx)),
    },
    {
      method: 'POST',
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/decisions$/,
      status: 201,
      handler: (ctx) => store.decide(id(ctx), ctx.body),
    },
    {
      method: 'GET',
      pattern: /^\/api\/applications\/(?<id>[^/]+)\/borrower-view$/,
      handler: (ctx) => store.borrowerView(id(ctx)),
    },
    {
      method: 'GET',
      pattern: /^\/api\/evidence-records\/(?<id>[^/]+)$/,
      handler: (ctx) => store.getEvidenceRecord(id(ctx)),
    },
  ];

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const matching = routes.filter((r) => r.pattern.test(path));

    if (matching.length === 0) return sendError(res, 404, 'not_found', `No route for ${path}`);
    const route = matching.find((r) => r.method === method);
    if (!route) {
      res.setHeader('Allow', [...new Set(matching.map((r) => r.method))].join(', '));
      return sendError(res, 405, 'method_not_allowed', `${req.method} is not supported on ${path}`);
    }

    try {
      const params = Object.fromEntries(
        Object.entries(route.pattern.exec(path)?.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]),
      );
      const body = route.method === 'POST' ? await readJson(req) : undefined;
      const result = await route.handler({ params, query: url.searchParams, body });
      if (result === undefined) return sendError(res, 404, 'not_found', `Nothing found at ${path}`);
      return sendJson(res, route.status ?? 200, result);
    } catch (err) {
      if (err instanceof ApiProblem) return sendError(res, err.status, err.code, err.message, err.fields);
      if (err instanceof URIError) return sendError(res, 404, 'not_found', `Nothing found at ${path}`);
      console.error(err);
      return sendError(res, 500, 'internal', 'Internal error');
    }
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new ApiProblem(400, 'Request body is too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiProblem(400, 'Request body must be JSON');
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function sendError(
  res: ServerResponse,
  status: number,
  code: ApiError['error']['code'],
  message: string,
  fields?: ApiError['error']['fields'],
) {
  const body: ApiError = { error: { code, message, ...(fields ? { fields } : {}) } };
  sendJson(res, status, body);
}
