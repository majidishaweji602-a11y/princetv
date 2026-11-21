import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getDramas, searchDramas } from '../services/drama';
import { useStore } from '../context/Store';
import { DramaCard } from '../components/Cards';
import { CardSkeletons, Empty, ErrorState } from '../components/Ui';

export default function DramaBox() {
  const { isHidden } = useStore();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [tag, setTag] = useState('');
  const [limit, setLimit] = useState(30);
  const all = useAsync((f) => getDramas(f), [], 'dramabox');
  const found = useAsync((f) => (dq.trim() ? searchDramas(dq, f) : Promise.resolve(null)), [dq], 'dramabox');
  useEffect(() => setLimit(30), [dq, tag]);

  const base = useMemo(() => (dq.trim() && found.data ? found.data : all.data ?? []).filter((d) => !isHidden('drama', d.id)), [dq, found.data, all.data, isHidden]);
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    (all.data ?? []).forEach((d) => d.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t);
  }, [all.data]);
  const list = tag ? base.filter((d) => d.tags.includes(tag)) : base;

  return (
    <div className="page">
      <h1 className="h-title">🎬 DramaBox <span className="text-sm font-medium text-muted">Short dramas</span></h1>
      <div className="relative mt-4 max-w-xl"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Search dramas…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {tags.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <button className={`chip ${!tag ? 'chip-on' : ''}`} onClick={() => setTag('')}>All</button>
          {tags.map((t) => <button key={t} className={`chip ${tag === t ? 'chip-on' : ''}`} onClick={() => setTag(t)}>{t}</button>)}
        </div>
      )}
      <div className="mt-5">
        {all.error && !all.data ? <ErrorState message={all.error.message} onRetry={all.reload} title="DramaBox is unavailable" /> :
          (all.loading && !all.data) || (found.loading && !found.data && dq.trim()) ? <CardSkeletons n={12} /> :
            list.length === 0 ? <Empty icon="🔎" title="No dramas found" hint={dq ? `Nothing matches “${dq}”.` : 'The API returned no dramas.'} /> : (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {list.slice(0, limit).map((d) => <DramaCard key={d.id} d={d} className="w-full" />)}
                </div>
                {list.length > limit && <div className="mt-6 text-center"><button className="btn-ghost" onClick={() => setLimit((l) => l + 30)}>Load more</button></div>}
              </>
            )}
      </div>
    </div>
  );
}
