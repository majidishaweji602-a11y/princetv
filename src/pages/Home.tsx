import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getDramas } from '../services/drama';
import { getCountries, getLiveChannels } from '../services/iptv';
import { useStore } from '../context/Store';
import { ChannelCard, DramaCard } from '../components/Cards';
import { CardSkeletons, ErrorState, Row, Section, SeeAll, Skel } from '../components/Ui';

interface Slide { key: string; title: string; sub?: string; image?: string; to: string; badge: string }

function Hero({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i % slides.length];
  return (
    <div className="relative aspect-[1.08] max-h-[34rem] w-full overflow-hidden rounded-[1.75rem] border border-line bg-surface sm:aspect-[2.2]">
      {s.image && <img key={s.key} src={s.image} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full animate-fadeUp object-cover object-top" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <span className="absolute left-4 top-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold uppercase tracking-wider text-black sm:left-6 sm:top-6">{s.badge}</span>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-8">
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-3xl font-extrabold leading-tight text-white sm:text-5xl">{s.title}</h1>
          {s.sub && <p className="mt-1 truncate text-xl font-semibold capitalize text-brand">{s.sub}</p>}
        </div>
        <Link to={s.to} className="flex shrink-0 items-center gap-2 rounded-2xl bg-brand px-6 py-4 text-lg font-extrabold uppercase tracking-wide text-black shadow-lg transition active:scale-95">
          <Play size={22} fill="currentColor" /> Tazama
        </Link>
      </div>
      {slides.length > 1 && (
        <div className="absolute right-4 top-6 flex gap-1.5 sm:right-6">
          {slides.map((x, n) => <button key={x.key} aria-label={`Slide ${n + 1}`} onClick={() => setI(n)} className={`h-1.5 rounded-full transition-all ${n === i % slides.length ? 'w-6 bg-brand' : 'w-1.5 bg-white/50'}`} />)}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { config, isHidden } = useStore();
  const dramas = useAsync((f) => getDramas(f), [], 'dramabox');
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const countries = useAsync((f) => getCountries(f), [], 'iptv');

  const list = useMemo(() => (dramas.data ?? []).filter((d) => !isHidden('drama', d.id)), [dramas.data, isHidden]);
  const channels = useMemo(() => (live.data ?? []).filter((c) => !isHidden('channel', c.id)), [live.data, isHidden]);
  // Your own channels (src/data/custom-channels.json). If you have none, fall back to popular channels.
  const mine = useMemo(() => channels.filter((c) => c.custom), [channels]);
  const row = useMemo(() => {
    if (mine.length) return mine;
    const pref = ['news', 'sports', 'entertainment', 'movies', 'music'];
    return channels.filter((c) => c.logo && c.categories?.some((k) => pref.includes(k))).sort((a, b) => b.streams.length - a.streams.length).slice(0, 16);
  }, [mine, channels]);

  const slides: Slide[] = useMemo(() => {
    const out: Slide[] = [];
    for (const f of config.featured) {
      const isDrama = f.type === 'drama';
      out.push({ key: `f-${f.type}-${f.id}`, title: f.title, image: f.image, badge: isDrama ? 'Featured' : 'Featured Live',
        sub: isDrama ? 'Drama' : channels.find((c) => c.id === f.id)?.categories?.[0],
        to: isDrama ? `/drama/${encodeURIComponent(f.id)}` : `/live?channel=${encodeURIComponent(f.id)}` });
    }
    const feat = mine.filter((c) => c.featured);
    for (const c of feat.length ? feat : mine.slice(0, 1)) {
      out.push({ key: `c-${c.id}`, title: c.name, image: c.image ?? c.logo ?? undefined, badge: 'Featured Live', sub: c.categories?.[0], to: `/live?channel=${encodeURIComponent(c.id)}` });
    }
    return out;
  }, [config.featured, channels, mine]);

  const recent = useMemo(() => [...list].reverse().slice(0, 14), [list]);

  return (
    <div className="page !pt-3">
      {live.loading && !live.data ? <Skel className="aspect-[1.08] w-full !rounded-[1.75rem] sm:aspect-[2.2]" /> :
        slides.length ? <Hero slides={slides} /> : null}

      <Section title="Live TV Channels" live action={<SeeAll to="/live" />}>
        {live.error && !live.data ? <ErrorState message={live.error.message} onRetry={live.reload} /> :
          live.loading && !live.data ? <CardSkeletons n={6} ratio="aspect-[3/2]" /> :
            <Row>{row.map((c) => <ChannelCard key={c.id} c={c} countries={countries.data} className="w-44 sm:w-56" />)}</Row>}
      </Section>

      <Section title="Filamu & Series Mpya" action={<SeeAll to="/dramabox" />}>
        {dramas.error && !dramas.data ? <ErrorState message={dramas.error.message} onRetry={dramas.reload} /> :
          dramas.loading && !dramas.data ? <CardSkeletons n={6} /> :
            recent.length ? <Row>{recent.map((d) => <DramaCard key={d.id} d={d} />)}</Row> : <ErrorState title="Hakuna filamu" message="Orodha haikupatikana." onRetry={dramas.reload} />}
      </Section>
    </div>
  );
}
