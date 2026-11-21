const seen = new Map<string, number>();
export function reportError(message: string, source = 'client') {
  const k = source + message;
  const now = Date.now();
  if (now - (seen.get(k) ?? 0) < 60_000) return; // throttle duplicates
  seen.set(k, now);
  try {
    fetch('/api/log-error', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: String(message).slice(0, 500), source, path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}
export function trackView(path: string) {
  try {
    fetch('/api/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }), keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}
