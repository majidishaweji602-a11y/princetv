import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Info, Search, Tv } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getCountries, getGuides, getLanguages, getLiveChannels } from '../services/iptv';
import { useStore } from '../context/Store';
import VideoPlayer from '../components/VideoPlayer';
import { FavButton } from '../components/Cards';
import { CardSkeletons, Empty, ErrorState, Skel } from '../components/Ui';
import { CATEGORY_ICONS, catIcon } from '../lib/constants';
import type { LiveChannel } from '../types';

export function ChannelLogo({ c, size = 40 }: { c: LiveChannel; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white/90 p-1 dark:bg-white/10" style={{ width: size, height: size }}>
      {c.logo ? <img src={c.logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="max-h-full max-w-full object-contain" /> : <Tv size={size / 2} />}
    </div>
  );
}

function ChannelGuide({ channel }: { channel: LiveChannel }) {
  const g = useAsync((f) => getGuides(f), [], 'iptv');
  if (g.loading && !g.data) return <Skel className="h-16 w-full" />;
  if (g.error) return <p className="text-sm text-muted">Guide data is unavailable right now.</p>;
  const ids = new Set([channel.id, channel.name, ...(channel.alt_names ?? [])].map((v) => String(v).toLowerCase()));
  const entries = (g.data ?? []).filter((e) => e.channel === channel.id || ids.has(String(e.channel ?? '').toLowerCase()));
  if (!entries.length) return <p className="text-sm text-muted">No programme guide is listed for this channel.</p>;
  const now = Date.now();
  const programmes = entries.filter((e) => e.title && e.start && (!e.stop || Date.parse(String(e.stop)) > now)).sort((a, b) => Number(new Date(a.start!)) - Number(new Date(b.start!))).slice(0, 8);
  if (programmes.length) {
    return (
      <ul className="space-y-1.5 text-sm">
        {programmes.map((p, i) => (
          <li key={i} className="flex gap-3">{(p.image || p.poster || p.thumbnail || p.icon) && <img src={p.image || p.poster || p.thumbnail || p.icon} alt="" className="h-12 w-16 rounded object-cover" loading="lazy" />}<span className="w-28 shrink-0 text-muted">{new Date(p.start!).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span><span>{p.title}{p.description && <span className="block text-xs text-muted">{p.description}</span>}</span></li>
        ))}
      </ul>
    );
  }
  return (
    <div className="text-sm">
      <p className="text-muted">Guide sources available for this channel:</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{entries.map((e, i) => <span key={i} className="chip !py-0.5 text-xs">{e.site_name ?? e.site}{e.lang ?? e.site_lang ? ` · ${e.lang ?? e.site_lang}` : ''}</span>)}</div>
    </div>
  );
}

export default function LiveTV() {
  const [sp, setSp] = useSearchParams();
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const countries = useAsync((f) => getCountries(f), [], 'iptv');
  const langs = useAsync((f) => getLanguages(f), [], 'iptv');
  const { isHidden, addHistory, history } = useStore();

  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDeferredValue(q);
  const [country, setCountry] = useState(sp.get('country') ?? '');
  const [lang, setLang] = useState(sp.get('lang') ?? '');
  const cat = sp.get('cat') ?? '';
  const selId = sp.get('channel') ?? '';
  const [limit, setLimit] = useState(60);
  const [srcIdx, setSrcIdx] = useState(0);
  useEffect(() => setLimit(60), [dq, country, lang, cat]);

  const all = useMemo(() => (live.data ?? []).filter((c) => !isHidden('channel', c.id)), [live.data, isHidden]);
  const selected = useMemo(() => all.find((c) => c.id === selId), [all, selId]);

  useEffect(() => {
    if (selected) addHistory({ type: 'channel', id: selected.id, title: selected.name, image: selected.logo ?? undefined, sub: selected.country });
    setSrcIdx(0);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const countryOpts = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((c) => c.country && counts.set(c.country, (counts.get(c.country) ?? 0) + 1));
    return [...counts.entries()].map(([code, n]) => ({ code, n, name: countries.data?.find((x) => x.code === code)?.name ?? code, flag: countries.data?.find((x) => x.code === code)?.flag ?? '🌐' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, countries.data]);
  const langOpts = useMemo(() => {
    const set = new Set<string>(); all.forEach((c) => c.languages.forEach((l) => set.add(l)));
    return [...set].map((code) => ({ code, name: langs.data?.find((l) => l.code === code)?.name ?? code })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, langs.data]);

  const filtered = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return all.filter((c) =>
      (!cat || c.categories?.includes(cat)) && (!country || c.country === country) && (!lang || c.languages.includes(lang)) &&
      (!t || c.name.toLowerCase().includes(t) || c.alt_names?.some((a) => a.toLowerCase().includes(t))));
  }, [all, dq, cat, country, lang]);

  const setCat = (id: string) => { const n = new URLSearchParams(sp); if (id) n.set('cat', id); else n.delete('cat'); setSp(n, { replace: true }); };
  const select = (id: string) => { const n = new URLSearchParams(sp); n.set('channel', id); setSp(n, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const recent = history.filter((h) => h.type === 'channel').slice(0, 8);

  if (live.error && !live.data) return <div className="page"><ErrorState message={live.error.message} onRetry={live.reload} title="Live TV is unavailable" /></div>;

  const flag = (code?: string) => countryOpts.find((c) => c.code === code)?.flag ?? '🌐';

  return (
    <div className="page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h1 className="h-title">📺 Live TV {all.length > 0 && <span className="text-sm font-medium text-muted">· {all.length.toLocaleString()} channels</span>}</h1>
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <button className={`chip ${!cat ? 'chip-on' : ''}`} onClick={() => setCat('')}>All</button>
        {Object.entries(CATEGORY_ICONS).map(([id, c]) => <button key={id} className={`chip ${cat === id ? 'chip-on' : ''}`} onClick={() => setCat(id)}>{c.icon} {c.label}</button>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {selected ? (
            <>
              <VideoPlayer live title={selected.name} poster={selected.image ?? selected.logo ?? undefined} autoPlay sources={selected.streams.map((s) => ({ url: s.url, label: s.quality ?? s.title }))} onSourceChange={setSrcIdx} />
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <ChannelLogo c={selected} size={52} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold">{selected.name}</h2>
                    <div className="text-sm text-muted">{flag(selected.country)} {countryOpts.find((c) => c.code === selected.country)?.name ?? selected.country ?? 'Unknown country'}{selected.network ? ` · ${selected.network}` : ''}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{selected.categories?.map((k) => <span key={k} className="chip !py-0.5 text-xs">{catIcon(k)} {k}</span>)}</div>
                  </div>
                  <FavButton type="channel" id={selected.id} title={selected.name} image={selected.logo ?? undefined} sub={selected.country} className="!bg-surface !text-fg border border-line" />
                </div>
                {selected.website && <a href={selected.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-brand"><ExternalLink size={14} /> Official website</a>}
                <h3 className="mt-4 text-sm font-bold">Stream information</h3>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {selected.streams.slice(0, 6).map((s, i) => (
                    <li key={i} className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 ${i === srcIdx ? 'bg-brand/15' : ''}`}>
                      <span className="font-medium">Stream {i + 1}</span>
                      <span className="text-muted">{s.quality || 'quality n/a'}{s.title ? ` · ${s.title}` : ''}</span>
                      {(s.referrer || s.user_agent) && <span className="inline-flex items-center gap-1 text-xs text-amber-500"><Info size={12} /> may need provider headers</span>}
                      {s.url.startsWith('http:') && <span className="text-xs text-amber-500">http only</span>}
                    </li>
                  ))}
                </ul>
                <h3 className="mt-4 text-sm font-bold">TV guide</h3>
                <div className="mt-1.5"><ChannelGuide channel={selected} /></div>
              </div>
            </>
          ) : (
            <div className="card grid aspect-video place-items-center p-6 text-center">
              <div><div className="text-5xl">📡</div><div className="mt-2 text-lg font-bold">Pick a channel to start watching</div><p className="text-sm text-muted">Use the list{' '}<span className="lg:hidden">below</span><span className="max-lg:hidden">on the right</span> or the filters above it.</p></div>
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold">Recently watched</h3>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {recent.map((r) => <button key={r.key} onClick={() => select(r.id)} className="chip">{r.image && <img src={r.image} alt="" className="h-5 w-5 object-contain" referrerPolicy="no-referrer" />}{r.title}</button>)}
              </div>
            </div>
          )}
        </div>

        <aside className="card flex min-h-0 flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="space-y-2 border-b border-line/70 p-3">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Search channels…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
                <option value="">All countries</option>
                {countryOpts.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.n})</option>)}
              </select>
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
                <option value="">All languages</option>
                {langOpts.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
            <div className="text-xs text-muted">{filtered.length.toLocaleString()} channels</div>
          </div>
          <div className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-none">
            {live.loading && !live.data ? <div className="p-2"><CardSkeletons n={6} ratio="aspect-[5/1]" /></div> :
              filtered.length === 0 ? <Empty icon="🔎" title="No channels match" hint="Try different filters." /> :
                filtered.slice(0, limit).map((c) => (
                  <button key={c.id} onClick={() => select(c.id)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-brand/10 ${c.id === selId ? 'bg-brand/15 ring-1 ring-brand/50' : ''}`}>
                    <ChannelLogo c={c} />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="truncate text-xs text-muted">{flag(c.country)} {c.country} · {c.categories?.slice(0, 2).map(catIcon).join(' ')} {c.quality ?? ''}</div></div>
                  </button>
                ))}
            {filtered.length > limit && <button className="btn-ghost mt-2 w-full" onClick={() => setLimit((l) => l + 80)}>Load more</button>}
          </div>
        </aside>
      </div>
      <p className="mt-4 text-xs text-muted">Only streams supplied by the IPTV API are used. Some may be geo-restricted, offline or require provider headers that browsers cannot send. Use the skip button in the player to try another stream. <Link to="/contact" className="text-brand">Report a problem</Link></p>
    </div>
  );
}
