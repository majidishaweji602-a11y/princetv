import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, RefreshCw, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { reportError } from '../lib/report';

export interface Source { url: string; label?: string }
interface Props {
  sources: Source[];
  title: string;
  poster?: string;
  live?: boolean;
  startAt?: number;
  autoPlay?: boolean;
  onTime?: (t: number, d: number) => void;
  onEnded?: () => void;
  onSourceChange?: (i: number) => void;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(sec).padStart(2, '0')}`;
};
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ sources, title, poster, live, startAt, autoPlay = true, onTime, onEnded, onSourceChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const idleTimer = useRef<number>();
  const retries = useRef(0);
  const lastProgress = useRef(0);
  const lastProgressAt = useRef(0);
  const startRef = useRef(startAt);
  startRef.current = startAt;

  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [fs, setFs] = useState(false);
  const [show, setShow] = useState(true);
  const pipOk = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  const key = sources.map((s) => s.url).join('|');
  useEffect(() => { setIdx(0); setAttempt(0); setError(null); retries.current = 0; }, [key]);
  useEffect(() => { onSourceChange?.(idx); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback((reason: string) => {
    reportError(`Stream failed: ${reason}`, 'player');
    retries.current = 0;
    setIdx((i) => {
      if (i < sources.length - 1) return i + 1;
      setError(`${reason}. No more alternative streams are available.`);
      setLoading(false);
      return i;
    });
  }, [sources.length]);

  useEffect(() => {
    const v = vid.current;
    const src = sources[idx];
    if (!v) return;
    setError(null); setLoading(true);
    if (!src) { setError('No playable stream was provided for this item.'); setLoading(false); return; }
    // HTTPS pages cannot play insecure HTTP media in most browsers. Do not
    // silently proxy arbitrary URLs: that would create an SSRF/open-proxy risk.
    if (location.protocol === 'https:' && src.url.startsWith('http:')) {
      setError('This channel uses an HTTP stream. Your HTTPS browser blocks it; the stream provider must supply HTTPS or an authorized same-origin relay.');
      setLoading(false);
      return;
    }
    const isHls = /\.m3u8(\?|#|$)/i.test(src.url) || /m3u8/i.test(src.url);
    let hls: Hls | null = null;
    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        // A slightly larger buffer helps absorb short network fluctuations.
        // Low-latency mode is intentionally off for more stable live playback.
        lowLatencyMode: false,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        backBufferLength: 45,
        maxBufferHole: 0.5,
        nudgeMaxRetry: 5,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 5,
        fragLoadingRetryDelay: 1000,
      });
      hlsRef.current = hls;
      hls.loadSource(src.url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (autoPlay) v.play().catch(() => setPlaying(false)); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) {
          // Recover from a non-fatal buffer stall without tearing down playback.
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR && retries.current < 3) {
            retries.current++;
            hls?.startLoad();
          }
          return;
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries.current < 4) {
          retries.current++;
          window.setTimeout(() => hls?.startLoad(-1), Math.min(8000, 1000 * (2 ** (retries.current - 1))));
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries.current < 3) {
          retries.current++;
          hls?.recoverMediaError();
          return;
        }
        advance(data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'The stream is offline, blocked by CORS, or unreachable' : 'The stream could not be decoded');
      });
    } else {
      v.src = src.url; // native HLS (Safari/iOS) or direct mp4
      if (autoPlay) v.play().catch(() => setPlaying(false));
    }
    return () => { hls?.destroy(); hlsRef.current = null; v.pause(); v.removeAttribute('src'); v.load(); };
  }, [idx, attempt, key, live, autoPlay, advance]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const poke = () => {
    setShow(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => { if (vid.current && !vid.current.paused) setShow(false); }, 3000);
  };
  const toggle = () => { const v = vid.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen(); else wrap.current?.requestFullscreen?.().catch(() => {}); };
  const togglePip = async () => {
    const v = vid.current; if (!v) return;
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); } catch { /* unsupported */ }
  };
  const retry = () => { retries.current = 0; setError(null); setIdx(0); setAttempt((a) => a + 1); };

  return (
    <div
      ref={wrap} tabIndex={0} onMouseMove={poke} onTouchStart={poke}
      onKeyDown={(e) => {
        const v = vid.current; if (!v) return;
        if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
        else if (e.key === 'f') toggleFs();
        else if (e.key === 'm') { v.muted = !v.muted; }
        else if (!live && e.key === 'ArrowRight') v.currentTime += 10;
        else if (!live && e.key === 'ArrowLeft') v.currentTime -= 10;
      }}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black outline-none ring-1 ring-line/60 focus-visible:ring-brand"
    >
      <video
        ref={vid} poster={poster} playsInline className="h-full w-full bg-black"
        onClick={toggle}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={() => { setPlaying(false); setShow(true); }}
        onWaiting={() => { setLoading(true); lastProgressAt.current = Date.now(); }}
        onStalled={() => { setLoading(true); if (hlsRef.current && retries.current < 3) { retries.current++; hlsRef.current.startLoad(); } }}
        onPlaying={() => { setLoading(false); setError(null); lastProgress.current = vid.current?.currentTime || 0; lastProgressAt.current = Date.now(); }}
        onCanPlay={() => setLoading(false)}
        onLoadedMetadata={() => {
          const v = vid.current!; setDur(v.duration);
          if (!live && startRef.current && startRef.current > 5 && startRef.current < v.duration - 5) v.currentTime = startRef.current;
        }}
        onTimeUpdate={() => { const v = vid.current!; setTime(v.currentTime); lastProgress.current = v.currentTime; lastProgressAt.current = Date.now(); if (!live) onTime?.(v.currentTime, v.duration); }}
        onVolumeChange={() => { const v = vid.current!; setMuted(v.muted); setVolume(v.volume); }}
        onEnded={() => onEnded?.()}
        onError={() => { if (!hlsRef.current && sources[idx]) advance('The video could not be loaded'); }}
      />

      {loading && !error && <div className="pointer-events-none absolute inset-0 grid place-items-center"><Loader2 className="animate-spin text-white/90" size={40} /></div>}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 p-4 text-center">
          <div className="max-w-sm">
            <AlertTriangle className="mx-auto text-amber-400" />
            <div className="mt-2 font-semibold text-white">Stream unavailable</div>
            <p className="mt-1 text-sm text-white/70">{error}</p>
            <button className="btn-primary mt-3" onClick={retry}><RefreshCw size={16} /> Retry</button>
          </div>
        </div>
      )}

      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-10 text-white transition-opacity duration-300 ${show || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {!live && (
          <input
            type="range" min={0} max={dur || 0} step={0.1} value={Math.min(time, dur || 0)} aria-label="Seek"
            onChange={(e) => { if (vid.current) vid.current.currentTime = Number(e.target.value); }}
            className="mb-1 h-1 w-full cursor-pointer accent-yellow-400"
          />
        )}
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="p-1 hover:text-yellow-300">{playing ? <Pause size={22} /> : <Play size={22} />}</button>
          <div className="group/vol flex items-center gap-1">
            <button aria-label="Mute" onClick={() => { if (vid.current) vid.current.muted = !vid.current.muted; }} className="p-1 hover:text-yellow-300">
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
              onChange={(e) => { const v = vid.current!; v.volume = Number(e.target.value); v.muted = Number(e.target.value) === 0; }}
              className="hidden h-1 w-20 cursor-pointer accent-yellow-400 sm:block" />
          </div>
          {live ? (
            <span className="flex items-center gap-1 text-xs font-bold"><i className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE</span>
          ) : (
            <span className="text-xs tabular-nums text-white/80">{fmt(time)} / {fmt(dur)}</span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-white/60 max-sm:hidden">{title}</span>
          <span className="flex-1 sm:hidden" />
          {sources.length > 1 && (
            <button onClick={() => { retries.current = 0; setIdx((i) => (i + 1) % sources.length); }} title="Try next stream" className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:text-yellow-300">
              <SkipForward size={16} /> {idx + 1}/{sources.length}
            </button>
          )}
          {!live && (
            <select aria-label="Playback speed" value={speed}
              onChange={(e) => { const s = Number(e.target.value); setSpeed(s); if (vid.current) vid.current.playbackRate = s; }}
              className="rounded bg-white/10 px-1 py-0.5 text-xs outline-none">
              {SPEEDS.map((s) => <option key={s} value={s} className="text-black">{s}x</option>)}
            </select>
          )}
          {pipOk && <button onClick={togglePip} aria-label="Picture in picture" className="p-1 hover:text-yellow-300"><PictureInPicture2 size={20} /></button>}
          <button onClick={toggleFs} aria-label="Fullscreen" className="p-1 hover:text-yellow-300">{fs ? <Minimize size={20} /> : <Maximize size={20} />}</button>
        </div>
      </div>
    </div>
  );
}
