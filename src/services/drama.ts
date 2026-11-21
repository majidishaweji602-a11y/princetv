import { cached, fetchJson } from '../lib/cache';
import type { Drama, DramaEpisode } from '../types';

export const DRAMA_BASE = (import.meta.env.VITE_DRAMABOX_API_URL || 'https://zimbox-api.top.co.zw/api/dramabox').replace(/\/$/, '');
const SEARCH_TPL = (import.meta.env.VITE_DRAMA_SEARCH_URL as string | undefined) || '';
const DETAIL_TPL = (import.meta.env.VITE_DRAMA_DETAIL_URL as string | undefined) || '';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/*
 * The DramaBox response shape could not be inspected while building this project (the
 * API host was not reachable from the build environment), so this adapter reads the
 * response defensively: it finds the list wherever it sits and maps the most common
 * field names. Open Admin → API Inspector to see the raw response, then adjust the
 * key lists below if your API uses different names.
 */
const KEYS = {
  id: ['bookId', 'book_id', 'dramaId', 'drama_id', 'id', '_id', 'vid', 'code', 'slug'],
  title: ['bookName', 'book_name', 'dramaName', 'drama_title', 'title', 'name'],
  desc: ['introduction', 'description', 'desc', 'synopsis', 'summary', 'intro', 'bookIntro', 'overview'],
  poster: ['coverWap', 'cover', 'coverUrl', 'cover_url', 'poster', 'posterUrl', 'image', 'img', 'thumbnail', 'thumb', 'pic', 'bookCover'],
  tags: ['tags', 'tagNames', 'tagList', 'genres', 'categories', 'labels'],
  count: ['chapterCount', 'episodeCount', 'episodes_count', 'totalEpisodes', 'total_episodes', 'chapter_count'],
  episodes: ['chapterList', 'chapters', 'episodes', 'episodeList', 'videos', 'playList', 'list'],
  epTitle: ['chapterName', 'chapter_name', 'title', 'name'],
  epUrl: ['url', 'videoUrl', 'video_url', 'playUrl', 'play_url', 'videoPath', 'video', 'mp4', 'mp4Url', 'm3u8', 'hls', 'src', 'link'],
  epCover: ['chapterImg', 'cover', 'image', 'thumbnail', 'thumb', 'img'],
};

function pick(o: Rec, keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.trim() || undefined : typeof v === 'number' ? String(v) : undefined;

function isUrl(s: string) { return /^https?:\/\//i.test(s) || s.startsWith('//'); }

/** Depth-limited search for the first playable-looking URL (.m3u8 / .mp4) inside an object. */
function findMediaUrl(v: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (typeof v === 'string') return isUrl(v) && /\.(m3u8|mp4|webm)(\?|#|$)/i.test(v) ? v : undefined;
  if (Array.isArray(v)) {
    for (const x of v) { const r = findMediaUrl(x, depth + 1); if (r) return r; }
  } else if (isRec(v)) {
    for (const x of Object.values(v)) { const r = findMediaUrl(x, depth + 1); if (r) return r; }
  }
  return undefined;
}

/** Locates the main array of objects inside any JSON response. */
function findList(json: unknown, depth = 0): Rec[] {
  if (Array.isArray(json)) return json.filter(isRec);
  if (!isRec(json) || depth > 3) return [];
  let best: Rec[] = [];
  for (const v of Object.values(json)) {
    const found = Array.isArray(v) ? v.filter(isRec) : findList(v, depth + 1);
    if (found.length > best.length) best = found;
  }
  return best;
}

function normEpisode(o: unknown, i: number): DramaEpisode | null {
  const index = i + 1; // position in the API's episode list (robust to 0- or 1-based numbering)
  if (typeof o === 'string') return isUrl(o) ? { index, title: `Episode ${index}`, url: o } : null;
  if (!isRec(o)) return null;
  const direct = str(pick(o, KEYS.epUrl));
  const url = (direct && isUrl(direct) ? direct : undefined) ?? findMediaUrl(o);
  return {
    index,
    title: str(pick(o, KEYS.epTitle)) ?? `Episode ${index}`,
    url,
    cover: str(pick(o, KEYS.epCover)),
  };
}

function normTags(v: unknown): string[] {
  if (typeof v === 'string') return v.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(v)) return [];
  return v.map((t) => (isRec(t) ? str(pick(t, ['name', 'tagName', 'title'])) : str(t))).filter(Boolean) as string[];
}

export function normDrama(o: Rec, i = 0): Drama | null {
  const title = str(pick(o, KEYS.title));
  const idRaw = str(pick(o, KEYS.id));
  if (!title && !idRaw) return null;
  const epsRaw = pick(o, KEYS.episodes);
  const episodes = Array.isArray(epsRaw)
    ? (epsRaw.map(normEpisode).filter(Boolean) as DramaEpisode[])
    : [];
  const countRaw = pick(o, KEYS.count);
  const count = typeof countRaw === 'number' ? countRaw : parseInt(String(countRaw ?? ''), 10);
  const poster = str(pick(o, KEYS.poster));
  return {
    id: idRaw ?? `idx-${i}-${(title ?? '').toLowerCase().replace(/\W+/g, '-')}`,
    title: title ?? `Drama ${idRaw}`,
    description: str(pick(o, KEYS.desc)),
    poster: poster && isUrl(poster) ? poster : undefined,
    tags: normTags(pick(o, KEYS.tags)),
    episodes,
    episodeCount: Number.isFinite(count) ? count : episodes.length || undefined,
    raw: o,
  };
}

export function normDramaList(json: unknown): Drama[] {
  // A response that is itself one drama (detail-style) with an episode list
  if (isRec(json) && pick(json, KEYS.title) && Array.isArray(pick(json, KEYS.episodes))) {
    const d = normDrama(json); return d ? [d] : [];
  }
  const seen = new Set<string>();
  const out: Drama[] = [];
  findList(json).forEach((o, i) => {
    const d = normDrama(o, i);
    if (d && !seen.has(d.id)) { seen.add(d.id); out.push(d); }
  });
  return out;
}

export function getDramas(force = false): Promise<Drama[]> {
  return cached('drama:list', async () => normDramaList(await fetchJson(DRAMA_BASE)), force);
}

export async function searchDramas(q: string, force = false): Promise<Drama[]> {
  const query = q.trim();
  if (!query) return [];
  if (SEARCH_TPL) {
    const url = SEARCH_TPL.replace('{q}', encodeURIComponent(query));
    return cached(`drama:search:${query.toLowerCase()}`, async () => normDramaList(await fetchJson(url)), force);
  }
  // No search endpoint configured: search the (cached) catalogue client-side.
  const all = await getDramas(force);
  const lq = query.toLowerCase();
  return all.filter((d) => d.title.toLowerCase().includes(lq) || d.tags.some((t) => t.toLowerCase().includes(lq)));
}

export async function getDrama(id: string, force = false): Promise<Drama | null> {
  const all = await getDramas(force);
  const found = all.find((d) => d.id === id) ?? null;
  if (found && (found.episodes.length > 0 || !DETAIL_TPL)) return found;
  if (DETAIL_TPL) {
    const url = DETAIL_TPL.replace('{id}', encodeURIComponent(id));
    const list = await cached(`drama:detail:${id}`, async () => normDramaList(await fetchJson(url)), force);
    const d = list.find((x) => x.id === id) ?? list[0];
    if (d) return { ...(found ?? d), ...d, poster: d.poster ?? found?.poster, description: d.description ?? found?.description };
  }
  return found;
}

/** Raw JSON for the admin API Inspector. */
export const fetchRawDrama = () => fetchJson<unknown>(DRAMA_BASE, 0);
