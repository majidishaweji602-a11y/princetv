import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getDrama } from '../services/drama';
import { useStore } from '../context/Store';
import VideoPlayer from '../components/VideoPlayer';
import { FavButton, Poster } from '../components/Cards';
import { Empty, ErrorState, Skel } from '../components/Ui';

export default function DramaDetail() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { addHistory, saveProgress, getProgress } = useStore();
  const d = useAsync((f) => getDrama(id, f), [id], 'dramabox');
  const lastSave = useRef(0);

  const drama = d.data;
  const saved = getProgress(id);
  const epParam = Number(sp.get('ep')) || 0;
  const firstPlayable = drama?.episodes.find((e) => e.url)?.index;
  const epNo = epParam || saved?.ep || firstPlayable || 1;
  const ep = useMemo(() => drama?.episodes.find((e) => e.index === epNo), [drama, epNo]);
  const startAt = saved && saved.ep === epNo ? saved.time : 0;

  useEffect(() => {
    if (drama && ep?.url) addHistory({ type: 'drama', id: drama.id, title: drama.title, image: drama.poster, ep: ep.index, sub: `Episode ${ep.index}` });
  }, [drama?.id, ep?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading && !drama) return <div className="page"><Skel className="aspect-video w-full" /><Skel className="mt-4 h-8 w-1/2" /></div>;
  if (d.error) return <div className="page"><ErrorState message={d.error.message} onRetry={d.reload} /></div>;
  if (!drama) return <div className="page"><Empty icon="🎬" title="Drama not found" hint="It may have been removed from the catalogue."><Link to="/dramabox" className="btn-primary mt-3">Back to DramaBox</Link></Empty></div>;

  const goEp = (n: number) => { const x = new URLSearchParams(sp); x.set('ep', String(n)); setSp(x, { replace: true }); };
  const nextEp = drama.episodes.find((e) => e.index > epNo && e.url);

  return (
    <div className="page">
      <Link to="/dramabox" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft size={16} /> DramaBox</Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {ep?.url ? (
            <VideoPlayer
              title={`${drama.title} · ${ep.title}`} poster={ep.cover ?? drama.poster} sources={[{ url: ep.url }]} startAt={startAt}
              onTime={(t, dur) => {
                if (Date.now() - lastSave.current < 5000) return; lastSave.current = Date.now();
                saveProgress({ dramaId: drama.id, title: drama.title, image: drama.poster, ep: epNo, time: t, duration: dur });
              }}
              onEnded={() => { if (nextEp) goEp(nextEp.index); }}
            />
          ) : (
            <div className="card grid aspect-video place-items-center p-6 text-center">
              <div><Lock className="mx-auto text-muted" /><div className="mt-2 font-semibold">{drama.episodes.length ? 'This episode has no playback URL' : 'No episodes available'}</div>
                <p className="text-sm text-muted">The API did not supply a playable stream for this {drama.episodes.length ? 'episode' : 'drama'}.</p></div>
            </div>
          )}
          <div className="mt-4 flex items-start gap-3">
            <div className="min-w-0 flex-1"><h1 className="text-2xl font-extrabold">{drama.title}</h1>
              {ep && <div className="text-sm text-muted">{ep.title}</div>}</div>
            <FavButton type="drama" id={drama.id} title={drama.title} image={drama.poster} className="!bg-surface !text-fg border border-line" />
          </div>
          {drama.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{drama.tags.map((t) => <span key={t} className="chip !py-0.5 text-xs">{t}</span>)}</div>}
          {drama.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{drama.description}</p>}
        </div>

        <aside>
          <div className="mb-3 flex gap-3 lg:hidden"><div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl"><Poster src={drama.poster} alt={drama.title} /></div></div>
          <div className="card p-3">
            <h2 className="mb-2 font-bold">Episodes {drama.episodeCount ? <span className="text-sm font-normal text-muted">({drama.episodeCount})</span> : null}</h2>
            {drama.episodes.length === 0 ? <p className="text-sm text-muted">The API returned no episode list for this drama.</p> : (
              <div className="grid max-h-[60vh] grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8 lg:grid-cols-5">
                {drama.episodes.map((e) => (
                  <button key={e.index} disabled={!e.url} onClick={() => goEp(e.index)} title={e.title}
                    className={`aspect-square rounded-xl border text-sm font-semibold transition ${e.index === epNo ? 'grad-bg border-transparent text-black' : 'border-line/80 bg-surface/60 hover:border-brand/70'} disabled:opacity-35`}>
                    {e.index}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
