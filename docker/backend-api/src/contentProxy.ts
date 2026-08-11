import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 4096;
const JSON_MAX_BYTES = 1024 * 1024;
const LOTTIE_MAX_BYTES = 2 * 1024 * 1024;

export class ContentProxyError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export interface ContentProxy {
  fetchJson(url: string): Promise<unknown>;
  fetchLottie(url: string): Promise<{ body: Buffer; contentType: string }>;
}

type ResolvedAddress = { address: string; family: 4 | 6 };
type ProxyResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

export class OutboundContentProxy implements ContentProxy {
  constructor(private readonly timeoutMs: number) {}

  async fetchJson(rawUrl: string) {
    const response = await this.#fetch(rawUrl, JSON_MAX_BYTES, 'application/json, text/json;q=0.9');
    try {
      return JSON.parse(response.body.toString('utf8')) as unknown;
    } catch {
      throw new ContentProxyError('Upstream did not return valid JSON', 502);
    }
  }

  async fetchLottie(rawUrl: string) {
    const response = await this.#fetch(
      rawUrl,
      LOTTIE_MAX_BYTES,
      'application/json, application/gzip, application/octet-stream;q=0.8',
    );
    const upstreamType = firstHeader(response.headers['content-type'])?.split(';', 1)[0]?.trim().toLowerCase();
    const allowedTypes = new Set([
      'application/json', 'text/json', 'application/gzip', 'application/octet-stream',
    ]);
    return {
      body: response.body,
      contentType: upstreamType && allowedTypes.has(upstreamType) ? upstreamType : 'application/octet-stream',
    };
  }

  async #fetch(rawUrl: string, maxBytes: number, accept: string) {
    let target = parseExternalUrl(rawUrl);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const address = await resolvePublicAddress(target.hostname);
      const response = await requestPinned(target, address, this.timeoutMs, maxBytes, accept);
      if (![301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new ContentProxyError(`Upstream returned ${response.statusCode}`, 502);
        }
        return response;
      }

      const location = firstHeader(response.headers.location);
      if (!location || redirects === MAX_REDIRECTS) {
        throw new ContentProxyError('Too many upstream redirects', 502);
      }
      target = parseExternalUrl(new URL(location, target).toString());
    }
    throw new ContentProxyError('Too many upstream redirects', 502);
  }
}

export function parseExternalUrl(rawUrl: string) {
  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    throw new ContentProxyError('Invalid URL', 400);
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ContentProxyError('Invalid URL', 400);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
    throw new ContentProxyError('Invalid URL', 400);
  }
  return url;
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;

  const normalized = address.toLowerCase();
  return !normalized.startsWith('::')
    && !normalized.startsWith('fc')
    && !normalized.startsWith('fd')
    && !/^fe[89ab]/.test(normalized)
    && !/^fe[c-f]/.test(normalized)
    && !normalized.startsWith('ff')
    && !normalized.startsWith('64:ff9b:')
    && !normalized.startsWith('2001:db8:');
}

function isPublicIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4
    || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return !(a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0)
    || a >= 224);
}

async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  hostname = hostname.replace(/^\[|\]$/g, '');
  if (hostname.toLowerCase() === 'localhost') {
    throw new ContentProxyError('Private targets are not allowed', 400);
  }
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new ContentProxyError('Private targets are not allowed', 400);
  }
  return addresses[0] as ResolvedAddress;
}

function requestPinned(
  url: URL,
  resolved: ResolvedAddress,
  timeoutMs: number,
  maxBytes: number,
  accept: string,
): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = requestFn(url, {
      method: 'GET',
      headers: {
        accept,
        'accept-encoding': 'identity',
        'user-agent': 'Yohi-Content-Proxy/1.0',
      },
      // eslint-disable-next-line no-null/no-null
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
      signal: AbortSignal.timeout(timeoutMs),
    }, (response) => {
      const contentLength = Number(firstHeader(response.headers['content-length']));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        response.destroy();
        reject(new ContentProxyError('Upstream response is too large', 413));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer | Uint8Array) => {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > maxBytes) {
          response.destroy(new ContentProxyError('Upstream response is too large', 413));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode ?? 502,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    request.on('error', (error) => {
      reject(error instanceof ContentProxyError
        ? error
        : new ContentProxyError(
          error.name === 'TimeoutError' ? 'Upstream timed out' : 'Upstream unavailable',
          502,
        ));
    });
    request.end();
  });
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
