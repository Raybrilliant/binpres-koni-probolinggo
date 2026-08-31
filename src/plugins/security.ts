import { Elysia } from 'elysia';
import { ENV } from '../env';

// ==== Rate limit: fixed-window sederhana per kunci (in-memory) ====
// ponytail: cukup untuk 1 instance; pakai Redis bila nanti multi-instance
const buckets = new Map<string, { n: number; reset: number }>();

export function overLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  return ++b.n > max;
}

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const ipOf = (headers: Headers) =>
  (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
  headers.get('x-real-ip') ||
  'local';

// ==== Header keamanan + rate limit global ====
export const security = (app: Elysia) =>
  app.onRequest(function sec({ set, request }) {
  const h = set.headers as Record<string, string>;
  h['x-content-type-options'] = 'nosniff';
  h['x-frame-options'] = 'DENY';
  h['referrer-policy'] = 'strict-origin-when-cross-origin';
  h['permissions-policy'] = 'camera=(), microphone=(), geolocation=()';
  h['cross-resource-opener-policy'] = 'same-origin';

  if (overLimit(`g:${ipOf(request.headers)}`, ENV.RATE_LIMIT)) return json(429, 'Terlalu banyak permintaan, coba lagi nanti.');
  });
