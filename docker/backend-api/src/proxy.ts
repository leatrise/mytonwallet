import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Network, Provider, Upstream, Upstreams } from './types.js';

const ALLOWED: Record<Provider, RegExp> = {
  toncenter: /^\/(?:api\/v2\/[A-Za-z][\w-]*|api\/v3\/(?:accountStates|actions|addressBook|jettonMasters|jettonWallets|messages|metadata|nftCollections|nftItems|pendingActions|traces|transactions)(?:\/[^/?#]+)?|api\/emulate\/v1\/emulateTrace|api\/streaming\/v2\/ws)\/?$/,
  tonapi: /^\/v2\/(?:accounts|blockchain|dns|events|gasless|jettons|lite-server|nfts|rates|status|traces|wallet)(?:\/[^?#]*)?$/,
};

const BROADCAST_RPC_METHODS = new Set(['sendBoc', 'sendBocReturnHash', 'sendQuery']);

export function parseProxyPath(url: string) {
  const parsed = new URL(url, 'http://internal');
  const match = /^\/(toncenter|tonapi)\/(mainnet|testnet)(\/.*)$/.exec(parsed.pathname);
  if (!match) return undefined;
  const provider = match[1] as Provider;
  const network = match[2] as Network;
  const path = match[3]!;
  if (!ALLOWED[provider].test(path) || path.includes('..')) return undefined;
  return { provider, network, path, search: parsed.search };
}

function isBroadcast(path: string, body: unknown) {
  if (path === '/api/v2/jsonRPC' && body && typeof body === 'object' && 'method' in body) {
    return BROADCAST_RPC_METHODS.has(String((body as { method: unknown }).method));
  }
  return path.includes('/send') || path.includes('/message');
}

function headers(apiKey?: string, contentType?: string) {
  return {
    accept: 'application/json',
    ...(contentType && { 'content-type': contentType }),
    ...(apiKey && { 'x-api-key': apiKey, Authorization: `Bearer ${apiKey}` }),
  };
}

async function requestUpstream(
  target: string,
  apiKey: string | undefined,
  request: FastifyRequest,
  body: string | undefined,
  timeoutMs: number,
) {
  return fetch(target, {
    method: request.method,
    headers: headers(apiKey, request.headers['content-type']),
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function proxyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  upstreams: Upstreams,
  timeoutMs: number,
) {
  const route = parseProxyPath(request.raw.url ?? '');
  if (!route || !['GET', 'POST'].includes(request.method)) return reply.code(404).send({ error: 'Not found' });

  const config: Upstream = upstreams[route.provider][route.network];
  if (!config.primary) return reply.code(503).send({ error: 'Upstream not configured' });
  const body = request.method === 'POST' ? JSON.stringify(request.body ?? {}) : undefined;
  const broadcast = isBroadcast(route.path, request.body);
  const candidates = [
    [config.primary, config.apiKey],
    ...(!broadcast && config.secondary ? [[config.secondary, config.secondaryApiKey]] : []),
  ] as [string, string | undefined][];

  let response: Response | undefined;
  for (const [baseUrl, apiKey] of candidates) {
    try {
      response = await requestUpstream(`${baseUrl.replace(/\/$/, '')}${route.path}${route.search}`, apiKey, request, body, timeoutMs);
      if (response.status !== 429 && response.status < 500) break;
    } catch {
      response = undefined;
    }
  }
  if (!response) return reply.code(502).send({ error: 'Chain provider unavailable' });

  const contentType = response.headers.get('content-type');
  if (contentType) reply.header('content-type', contentType);
  reply.header('cache-control', 'no-store');
  return reply.code(response.status).send(Buffer.from(await response.arrayBuffer()));
}
