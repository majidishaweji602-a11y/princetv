import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getCountries, getLiveChannels } from '../services/iptv';
import { useStore } from '../context/Store';
import { ChannelCard } from '../components/Cards';
import { CardSkeletons, Empty, ErrorState } from '../components/Ui';

function ChannelBrowse({ cat, title, icon }: { cat: string; title: string; icon: string }) {
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const countries = useAsync((f) => getCountries(f), [], 'iptv');
  const { isHidden } = useStore();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [country, setCountry] = useState('');
  const [limit, setLimit] = useState(36);
  useEffect(() => setLimit(36), [dq, country]);

  const base = useMemo(() => (live.data ?? []).filter((c) => c.categories?.includes(cat) && !isHidden('channel', c.id)), [live.data, cat, isHidden]);
  const opts = useMemo(() => {
    const codes = [...new Set(base.map((c) => c.country).filter(Boolean))] as string[];
    return codes.map((code) => { const c = countries.data?.find((x) => x.code === code); return { code, name: c?.name ?? code, flag: c?.flag ?? '🌐' }; }).sort((a, b) => a.name.localeCompare(b.name));
  }, [base, countries.data]);
  const list = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return base.filter((c) => (!country || c.country === country) && (!t || c.name.toLowerCase().includes(t)));
  }, [base, dq, country]);

  return (
    <div className="page">
      <h1 className="h-title">{icon} {title} {base.length > 0 && <span className="text-sm font-medium text-muted">· {base.length} live channels</span>}</h1>
      <div className="mt-4 grid max-w-2xl gap-2 sm:grid-cols-[1fr_200px]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder={`Search ${title.toLowerCase()} channels…`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country"><option value="">All countries</option>{opts.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select>
      </div>
      <div className="mt-5">
        {live.error && !live.data ? <ErrorState message={live.error.message} onRetry={live.reload} /> :
          live.loading && !live.data ? <CardSkeletons n={12} ratio="aspect-video" /> :
            list.length === 0 ? <Empty icon="📡" title="No channels found" hint="Try another country or search." /> : (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {list.slice(0, limit).map((c) => <ChannelCard key={c.id} c={c} countries={countries.data} to={`/live?channel=${encodeURIComponent(c.id)}&cat=${cat}`} className="w-full" />)}
                </div>
                {list.length > limit && <div className="mt-6 text-center"><button className="btn-ghost" onClick={() => setLimit((l) => l + 36)}>Load more</button></div>}
              </>
            )}
      </div>
    </div>
  );
}
export const Movies = () => <ChannelBrowse cat="movies" title="Movies" icon="🎬" />;
export const Sports = () => <ChannelBrowse cat="sports" title="Sports" icon="⚽" />;
