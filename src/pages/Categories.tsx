import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { getCategories, getLiveChannels } from '../services/iptv';
import { CATEGORY_ICONS, MAIN_CATEGORY_IDS, catIcon } from '../lib/constants';
import { CardSkeletons, ErrorState } from '../components/Ui';

export default function Categories() {
  const cats = useAsync((f) => getCategories(f), [], 'iptv');
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (live.data ?? []).forEach((c) => c.categories?.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1)));
    return m;
  }, [live.data]);
  const items = useMemo(() => {
    const apiCats = cats.data ?? [];
    const main = MAIN_CATEGORY_IDS.map((id) => ({ id, name: apiCats.find((c) => c.id === id)?.name ?? CATEGORY_ICONS[id].label }));
    const others = apiCats.filter((c) => !MAIN_CATEGORY_IDS.includes(c.id));
    return { main, others };
  }, [cats.data]);

  return (
    <div className="page">
      <h1 className="h-title">🗂️ Categories</h1>
      {cats.error && !cats.data && !live.data ? <div className="mt-4"><ErrorState message={cats.error.message} onRetry={cats.reload} /></div> : (
        <>
          <Link to="/dramabox" className="card mt-4 flex items-center gap-3 p-4 transition hover:border-brand/70"><span className="text-3xl">🎬</span><div><div className="font-bold">DramaBox</div><div className="text-sm text-muted">Short dramas, episode by episode</div></div></Link>
          {(cats.loading && !cats.data) ? <div className="mt-4"><CardSkeletons n={13} ratio="aspect-[3/2]" /></div> : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.main.map((c) => (
                <Link key={c.id} to={`/live?cat=${c.id}`} className="card group p-4 transition hover:-translate-y-0.5 hover:border-brand/70">
                  <div className="text-3xl transition group-hover:scale-110">{catIcon(c.id)}</div>
                  <div className="mt-2 font-bold">{c.name}</div>
                  <div className="text-xs text-muted">{live.data ? `${counts.get(c.id) ?? 0} channels` : '…'}</div>
                </Link>
              ))}
            </div>
          )}
          {items.others.length > 0 && (
            <>
              <h2 className="h-title mt-8">More categories</h2>
              <div className="mt-3 flex flex-wrap gap-2">{items.others.map((c) => <Link key={c.id} to={`/live?cat=${c.id}`} className="chip">{catIcon(c.id)} {c.name}{counts.get(c.id) ? ` (${counts.get(c.id)})` : ''}</Link>)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
