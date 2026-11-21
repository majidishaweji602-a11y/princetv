import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getGuides, getLiveChannels, getTimezones } from '../services/iptv';
import { ChannelLogo } from './LiveTV';
import { CardSkeletons, Empty, ErrorState } from '../components/Ui';

export default function TVGuide() {
  const guides = useAsync((f) => getGuides(f), [], 'iptv');
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const tz = useAsync((f) => getTimezones(f), [], 'iptv');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [sel, setSel] = useState('');
  const [limit, setLimit] = useState(60);

  const byChannel = useMemo(() => {
    const m = new Map<string, NonNullable<typeof guides.data>>();
    (guides.data ?? []).forEach((g) => { if (g.channel) { const a = m.get(g.channel); if (a) a.push(g); else m.set(g.channel, [g]); } });
    return m;
  }, [guides.data]);
  const channels = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return (live.data ?? []).filter((c) => (byChannel.has(c.id) || (guides.data ?? []).some((g) => [c.name, ...(c.alt_names ?? [])].some((n) => n.toLowerCase() === String(g.channel ?? '').toLowerCase()))) && (!t || c.name.toLowerCase().includes(t)));
  }, [live.data, byChannel, dq]);
  const chosen = channels.find((c) => c.id === sel) ?? null;
  const entries = chosen ? (byChannel.get(chosen.id) ?? (guides.data ?? []).filter((g) => [chosen.name, ...(chosen.alt_names ?? [])].some((n) => n.toLowerCase() === String(g.channel ?? '').toLowerCase()))) : [];
  const now = Date.now();
  const programmes = entries.filter((e) => e.title && e.start && (!e.stop || Date.parse(String(e.stop)) > now)).sort((a, b) => Number(new Date(a.start!)) - Number(new Date(b.start!)));
  const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const myOffset = tz.data?.find((z) => z.id === myTz)?.utc_offset;

  const err = guides.error ?? live.error;
  return (
    <div className="page">
      <h1 className="h-title">🗓️ TV Guide</h1>
      <p className="mt-1 text-sm text-muted">Your time zone: {myTz}{myOffset ? ` (UTC${myOffset})` : ''}</p>
      {err && !(guides.data && live.data) ? <div className="mt-4"><ErrorState message={err.message} onRetry={() => { guides.reload(); live.reload(); }} /></div> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="card flex max-h-[75vh] flex-col overflow-hidden">
            <div className="border-b border-line/70 p-3"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Search channels with a guide…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} /></div>
              <div className="mt-1.5 text-xs text-muted">{channels.length.toLocaleString()} channels with guide data</div></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {(guides.loading && !guides.data) || (live.loading && !live.data) ? <div className="p-2"><CardSkeletons n={6} ratio="aspect-[5/1]" /></div> :
                channels.length === 0 ? <Empty icon="🗓️" title="No guide data" /> :
                  channels.slice(0, limit).map((c) => (
                    <button key={c.id} onClick={() => setSel(c.id)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-brand/10 ${c.id === sel ? 'bg-brand/15 ring-1 ring-brand/50' : ''}`}>
                      <ChannelLogo c={c} /><div className="min-w-0"><div className="truncate text-sm font-semibold">{c.name}</div><div className="text-xs text-muted">{byChannel.get(c.id)?.length ?? 0} programme(s)</div></div>
                    </button>
                  ))}
              {channels.length > limit && <button className="btn-ghost mt-2 w-full" onClick={() => setLimit((l) => l + 80)}>Load more</button>}
            </div>
          </div>
          <div className="card p-5">
            {!chosen ? <Empty icon="👈" title="Select a channel" hint="Choose a channel to see its programme guide information." /> : (
              <>
                <div className="flex items-center gap-3"><ChannelLogo c={chosen} size={52} /><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{chosen.name}</h2><div className="text-sm text-muted">{chosen.country}</div></div>
                  <Link to={`/live?channel=${encodeURIComponent(chosen.id)}`} className="btn-primary">Watch live</Link></div>
                {programmes.length > 0 ? (
                  <ul className="mt-4 divide-y divide-line/60">
                    {programmes.slice(0, 40).map((p, i) => (
                      <li key={i} className="flex gap-4 py-2.5 text-sm">{(p.image || p.poster || p.thumbnail || p.icon) && <img src={p.image || p.poster || p.thumbnail || p.icon} alt="" className="h-14 w-20 rounded-lg object-cover" loading="lazy" />}<span className="w-36 shrink-0 text-muted">{new Date(p.start!).toLocaleString([], { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <div><div className="font-semibold">{p.title}</div>{p.description && <div className="line-clamp-2 text-muted">{p.description}</div>}</div></li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm text-muted">No programme schedule is currently available for this channel in the connected EPG source.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {entries.map((e, i) => (
                        <div key={i} className="rounded-xl border border-line/70 bg-surface/50 p-3 text-sm"><div className="font-semibold">{e.site_name ?? e.site ?? 'Guide source'}</div>
                          <div className="text-xs text-muted">{e.site}{e.site_id ? ` · ${e.site_id}` : ''}{e.lang ?? e.site_lang ? ` · ${e.lang ?? e.site_lang}` : ''}</div></div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
