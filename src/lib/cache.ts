const TTL = 5 * 60 * 1000; // 5 minutes
const PREFIX = 'sf:cache:';
const MAX_PERSIST_CHARS = 1_500_000;

interface Entry<T> { t: number; v: T }
const mem = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function readLS<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch { return null; }
}
function writeLS(key: string, e: Entry<unknown>) {
  try {
    const s = JSON.stringify(e);
    if (s.length <= MAX_PERSIST_CHARS) localStorage.setItem(PREFIX + key, s);
  } catch { /* quota exceeded: memory cache still works */ }
}

export class HttpError extends Error {
  status?: number;
  constructor(msg: string, status?: number) { super(msg); this.status = status; }
}

export async function fetchJson<T = unknown>(url: string, retries = 1, timeoutMs = 25000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new HttpError(`Request failed (${res.status})`, res.status);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e instanceof DOMException && e.name === 'AbortError' ? new HttpError('Request timed out') : e;
      if (e instanceof HttpError && e.status && e.status < 500 && e.status !== 429) break;
      if (i < retries) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    } finally { clearTimeout(timer); }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network error');
}

/** Cache for 5 minutes (memory + localStorage), dedupe concurrent calls. `force` bypasses (Retry buttons). */
export async function cached<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const now = Date.now();
  if (!force) {
    const m = mem.get(key) as Entry<T> | undefined;
    if (m && now - m.t < TTL) return m.v;
    const l = readLS<T>(key);
    if (l && now - l.t < TTL) { mem.set(key, l); return l.v; }
    const p = inflight.get(key) as Promise<T> | undefined;
    if (p) return p;
  }
  const p = fetcher().then((v) => {
    const e = { t: Date.now(), v };
    mem.set(key, e); writeLS(key, e);
    return v;
  }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function clearCache() {
  mem.clear();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
