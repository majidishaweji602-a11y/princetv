import { Link } from 'react-router-dom';
import { Heart, Play } from 'lucide-react';
import type { Drama, LiveChannel, Country } from '../types';
import { useStore } from '../context/Store';

export function FavButton({ type, id, title, image, sub, className = '' }: { type: 'drama' | 'channel'; id: string; title: string; image?: string; sub?: string; className?: string }) {
  const { isFav, toggleFav } = useStore();
  const on = isFav(type, id);
  return (
    <button
      aria-label={on ? 'Remove from watchlist' : 'Add to watchlist'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav({ type, id, title, image, sub }); }}
      className={`grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:scale-110 ${className}`}
    >
      <Heart size={16} className={on ? 'fill-pink-500 text-pink-500' : ''} />
    </button>
  );
}

export function Poster({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer"
      onError={(e) => { (e.currentTarget.style.visibility = 'hidden'); }}
      className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand/30 to-brand2/20 text-3xl">🎬</div>
  );
}

export function DramaCard({ d, className = 'w-36 sm:w-44' }: { d: Drama; className?: string }) {
  return (
    <Link to={`/drama/${encodeURIComponent(d.id)}`} className={`group block shrink-0 snap-start ${className}`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-line/70 bg-surface">
        <div className="h-full w-full transition duration-500 group-hover:scale-105"><Poster src={d.poster} alt={d.title} /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-80" />
        <FavButton type="drama" id={d.id} title={d.title} image={d.poster} className="absolute right-2 top-2" />
        <div className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full grad-bg text-black opacity-0 shadow-lg transition group-hover:opacity-100"><Play size={16} fill="currentColor" /></div>
        {d.episodeCount ? <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{d.episodeCount} eps</span> : null}
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{d.title}</div>
    </Link>
  );
}

export function ChannelCard({ c, countries, to, className = '' }: { c: LiveChannel; countries?: Country[]; to?: string; className?: string }) {
  const flag = countries?.find((x) => x.code === c.country)?.flag;
  const cat = c.categories?.[0];
  return (
    <Link to={to ?? `/live?channel=${encodeURIComponent(c.id)}`} className={`group block shrink-0 snap-start overflow-hidden rounded-2xl border border-line/70 bg-surface transition hover:border-brand/70 ${className}`}>
      <div className={`relative aspect-[3/2] overflow-hidden ${c.image ? 'bg-bg' : 'flex items-center justify-center bg-gradient-to-br from-line/40 to-bg p-5'}`}>
        {c.image ? (
          <img src={c.image} alt={c.name} loading="lazy" referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : c.logo ? (
          <img src={c.logo} alt={c.name} loading="lazy" referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105" />
        ) : <span className="text-4xl">📺</span>}
        <span className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-bold tracking-wide text-red-500">LIVE</span>
        <FavButton type="channel" id={c.id} title={c.name} image={c.image ?? c.logo ?? undefined} sub={c.country} className="absolute bottom-2 left-2" />
      </div>
      <div className="px-3.5 py-3">
        <div className="truncate text-base font-bold">{c.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm capitalize text-muted">
          <span>{flag ?? '🌐'}</span>{cat ? <span className="truncate">{cat}</span> : <span>{c.country ?? ''}</span>}
        </div>
      </div>
    </Link>
  );
}
