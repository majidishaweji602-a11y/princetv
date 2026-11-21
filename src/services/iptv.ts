import { cached, fetchJson } from '../lib/cache';
import type {
  BlockItem, Category, Channel, Country, GuideEntry, Language, LiveChannel, Region, Stream, Timezone,
} from '../types';
import customChannels from '../data/custom-channels.json';

const BASE = (import.meta.env.VITE_IPTV_API_URL || 'https://hostifytv.tcroneb-script.workers.dev').replace(/\/$/, '');

export const IPTV_ENDPOINTS = {
  countries: '/countries.json',
  languages: '/languages.json',
  categories: '/categories.json',
  streams: '/streams.json',
  channels: '/channels.json',
  guides: '/guides.json',
  blocklist: '/blocklist.json',
  regions: '/regions.json',
  timezones: '/timezones.json',
} as const;

export type EndpointKey = keyof typeof IPTV_ENDPOINTS;

/** Accepts a bare array or an object wrapping one ({data:[...]}). Never throws on odd shapes. */
function asArray<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object') {
    for (const v of Object.values(json as Record<string, unknown>)) if (Array.isArray(v)) return v as T[];
  }
  return [];
}

function get<T>(key: EndpointKey, force = false): Promise<T[]> {
  return cached<T[]>(`iptv:${key}`, async () => asArray<T>(await fetchJson(BASE + IPTV_ENDPOINTS[key])), force);
}

export const getCountries = (f = false) => get<Country>('countries', f);
export const getLanguages = (f = false) => get<Language>('languages', f);
export const getCategories = (f = false) => get<Category>('categories', f);
export const getStreams = (f = false) => get<Stream>('streams', f);
export const getChannels = (f = false) => get<Channel>('channels', f);
export const getGuides = (f = false) => cached<GuideEntry[]>('starrflix:epg', async () => {
  const response = await fetch('/api/epg');
  if (!response.ok) throw new Error(`EPG request failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload?.programmes) ? payload.programmes as GuideEntry[] : [];
}, f);
export const getBlocklist = (f = false) => get<BlockItem>('blocklist', f);
export const getRegions = (f = false) => get<Region>('regions', f);
export const getTimezones = (f = false) => get<Timezone>('timezones', f);

export async function pingEndpoint(key: EndpointKey) {
  const t0 = performance.now();
  try {
    const list = await get<unknown>(key, true);
    return { ok: true, ms: Math.round(performance.now() - t0), count: list.length };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t0), count: 0, error: (e as Error).message };
  }
}

const qRank = (q?: string | null) => {
  const n = parseInt(q ?? '', 10);
  return Number.isFinite(n) ? n : 0;
};
const hasHeaderReq = (s: Stream) => Boolean(s.referrer || s.user_agent);

let liveMemo: { t: number; p: Promise<LiveChannel[]> } | null = null;

/** Channels joined with their playable streams. Excludes blocklisted, closed and NSFW channels. */
export function getLiveChannels(force = false): Promise<LiveChannel[]> {
  if (!force && liveMemo && Date.now() - liveMemo.t < 5 * 60 * 1000) return liveMemo.p;
  const p = (async () => {
    const [channels, streams, countries, blocklist] = await Promise.all([
      getChannels(force), getStreams(force), getCountries(force).catch(() => [] as Country[]),
      getBlocklist(force).catch(() => [] as BlockItem[]),
    ]);
    const blocked = new Set(blocklist.map((b) => b.channel).filter(Boolean) as string[]);
    const langByCountry = new Map(countries.map((c) => [c.code, c.languages ?? []]));
    const byChannel = new Map<string, Stream[]>();
    for (const s of streams) {
      if (!s || !s.url || !s.channel) continue;
      const arr = byChannel.get(s.channel);
      if (arr) arr.push(s); else byChannel.set(s.channel, [s]);
    }
    const out: LiveChannel[] = [];
    // Your own channels (src/data/custom-channels.json) come first and bypass the blocklist.
    for (const c of customChannels as Array<Partial<LiveChannel> & { streams?: Array<{ url: string }> }>) {
      const ss = (c.streams ?? []).filter((s) => s?.url).map((s) => ({ ...s, channel: c.id }));
      if (!c.id || !c.name || !ss.length) continue;
      out.push({
        ...c, id: c.id, name: c.name, logo: c.logo || null, image: c.image || null, custom: true,
        country: c.country || undefined, categories: c.categories ?? ['entertainment'],
        streams: ss, quality: undefined, languages: [],
      });
    }
    for (const c of channels) {
      if (!c || !c.id || !c.name) continue;
      if (c.closed || c.is_nsfw || blocked.has(c.id)) continue;
      const ss = byChannel.get(c.id);
      if (!ss?.length) continue;
      // Prefer streams that need no special headers, then higher quality
      ss.sort((a, b) => Number(hasHeaderReq(a)) - Number(hasHeaderReq(b)) || qRank(b.quality) - qRank(a.quality));
      out.push({
        ...c,
        categories: c.categories ?? [],
        streams: ss,
        quality: ss[0].quality ?? undefined,
        languages: (c.country && langByCountry.get(c.country)) || [],
      });
    }
    return out;
  })();
  liveMemo = { t: Date.now(), p };
  p.catch(() => { liveMemo = null; });
  return p;
}
