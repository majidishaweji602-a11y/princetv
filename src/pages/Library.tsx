import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useStore } from '../context/Store';
import { Empty } from '../components/Ui';
import { FavButton } from '../components/Cards';
import type { Fav } from '../types';

const linkFor = (x: Fav & { ep?: number }) => x.type === 'drama' ? `/drama/${encodeURIComponent(x.id)}${x.ep ? `?ep=${x.ep}` : ''}` : `/live?channel=${encodeURIComponent(x.id)}`;

function Thumb({ x }: { x: Fav }) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-xl ${x.type === 'drama' ? 'h-20 w-14 bg-surface' : 'h-14 w-20 bg-white/90 p-1.5 dark:bg-white/10'}`}>
      {x.image ? <img src={x.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} className={x.type === 'drama' ? 'h-full w-full object-cover' : 'max-h-full max-w-full object-contain'} /> : <span className="text-2xl">{x.type === 'drama' ? '🎬' : '📺'}</span>}
    </div>
  );
}

export function Watchlist() {
  const { favs } = useStore();
  const [tab, setTab] = useState<'all' | 'drama' | 'channel'>('all');
  const list = favs.filter((f) => tab === 'all' || f.type === tab);
  return (
    <div className="page">
      <h1 className="h-title">❤️ My Watchlist</h1>
      <div className="mt-3 flex gap-2">{(['all', 'drama', 'channel'] as const).map((t) => <button key={t} className={`chip ${tab === t ? 'chip-on' : ''}`} onClick={() => setTab(t)}>{t === 'all' ? 'All' : t === 'drama' ? '🎬 Dramas' : '📺 Channels'}</button>)}</div>
      <div className="mt-5">
        {list.length === 0 ? <Empty icon="💜" title="Your watchlist is empty" hint="Tap the heart on any drama or channel to save it here."><Link to="/" className="btn-primary mt-3">Discover content</Link></Empty> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((x) => (
              <Link key={x.key} to={linkFor(x)} className="card flex items-center gap-3 p-3 transition hover:border-brand/70">
                <Thumb x={x} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{x.title}</div><div className="text-xs text-muted">{x.type === 'drama' ? 'DramaBox' : `Live TV${x.sub ? ` · ${x.sub}` : ''}`}</div></div>
                <FavButton type={x.type} id={x.id} title={x.title} image={x.image} sub={x.sub} className="!bg-transparent !text-fg" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function WatchHistory() {
  const { history, removeHistory, clearHistory } = useStore();
  return (
    <div className="page">
      <div className="flex items-center justify-between"><h1 className="h-title">🕘 Watch History</h1>
        {history.length > 0 && <button className="btn-ghost" onClick={() => { if (confirm('Clear your entire watch history?')) clearHistory(); }}><Trash2 size={16} /> Clear all</button>}</div>
      <div className="mt-5">
        {history.length === 0 ? <Empty icon="🕘" title="Nothing watched yet" hint="Dramas and channels you watch will appear here." /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((x) => (
              <div key={x.key} className="card flex items-center gap-3 p-3">
                <Link to={linkFor(x)} className="flex min-w-0 flex-1 items-center gap-3"><Thumb x={x} />
                  <div className="min-w-0"><div className="truncate font-semibold">{x.title}</div><div className="text-xs text-muted">{x.type === 'drama' ? `DramaBox${x.ep ? ` · Ep ${x.ep}` : ''}` : 'Live TV'} · {ago(x.ts)}</div></div></Link>
                <button aria-label="Remove" className="p-2 text-muted hover:text-fg" onClick={() => removeHistory(x.key)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
