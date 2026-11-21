import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { searchDramas } from '../services/drama';
import { getCountries, getLiveChannels } from '../services/iptv';
import { useStore } from '../context/Store';
import { ChannelCard, DramaCard } from '../components/Cards';
import { CardSkeletons, Empty, ErrorState, Section } from '../components/Ui';

export default function SearchPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const { isHidden } = useStore();
  const dramas = useAsync((f) => searchDramas(q, f), [q], 'dramabox');
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const countries = useAsync((f) => getCountries(f), [], 'iptv');
  const channels = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return (live.data ?? []).filter((c) => !isHidden('channel', c.id) && (c.name.toLowerCase().includes(t) || c.alt_names?.some((a) => a.toLowerCase().includes(t)))).slice(0, 36);
  }, [live.data, q, isHidden]);
  const dr = (dramas.data ?? []).filter((d) => !isHidden('drama', d.id));

  return (
    <div className="page">
      <form onSubmit={(e) => { e.preventDefault(); setSp(text.trim() ? { q: text.trim() } : {}); }} className="relative max-w-2xl">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input autoFocus className="input !py-3 pl-10 text-base" placeholder="Search dramas and live channels…" value={text} onChange={(e) => setText(e.target.value)} />
      </form>
      {!q.trim() ? <div className="mt-6"><Empty icon="🔎" title="Search STARR FLIX" hint="Find short dramas and live TV channels." /></div> : (
        <>
          <Section title={`Dramas${dr.length ? ` (${dr.length})` : ''}`}>
            {dramas.error ? <ErrorState message={dramas.error.message} onRetry={dramas.reload} /> : dramas.loading && !dramas.data ? <CardSkeletons n={6} /> :
              dr.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{dr.slice(0, 24).map((d) => <DramaCard key={d.id} d={d} className="w-full" />)}</div> : <p className="text-sm text-muted">No dramas match “{q}”.</p>}
          </Section>
          <Section title={`Live channels${channels.length ? ` (${channels.length}${channels.length === 36 ? '+' : ''})` : ''}`}>
            {live.error ? <ErrorState message={live.error.message} onRetry={live.reload} /> : live.loading && !live.data ? <CardSkeletons n={6} ratio="aspect-video" /> :
              channels.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{channels.map((c) => <ChannelCard key={c.id} c={c} countries={countries.data} className="w-full" />)}</div> : <p className="text-sm text-muted">No channels match “{q}”.</p>}
          </Section>
        </>
      )}
    </div>
  );
}
