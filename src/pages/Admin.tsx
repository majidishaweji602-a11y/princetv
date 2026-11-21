import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertOctagon, BarChart3, Database, EyeOff, Lock, LogOut, Settings, Star, Users } from 'lucide-react';
import { adminApi, type AdminStats, type AdminUser, type ErrorLog } from '../services/admin';
import { DRAMA_BASE, fetchRawDrama, getDramas } from '../services/drama';
import { IPTV_ENDPOINTS, getLiveChannels, pingEndpoint, type EndpointKey } from '../services/iptv';
import { clearCache } from '../lib/cache';
import { useAsync } from '../lib/useAsync';
import { Empty, Skel } from '../components/Ui';
import { useStore } from '../context/Store';
import type { PublicConfig } from '../types';

type Tab = 'overview' | 'api' | 'content' | 'users' | 'settings' | 'errors';
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 }, { id: 'api', label: 'API status', icon: Database },
  { id: 'content', label: 'Content', icon: Star }, { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings }, { id: 'errors', label: 'Errors', icon: AlertOctagon },
];

function Login({ onDone }: { onDone: (u: string) => void }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <div className="page grid min-h-[60vh] place-items-center">
      <form className="card w-full max-w-sm space-y-3 p-6" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr('');
        try { const r = await adminApi.login(u, p); onDone(r.username); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
      }}>
        <div className="grid h-12 w-12 place-items-center rounded-2xl grad-bg text-black"><Lock size={22} /></div>
        <h1 className="text-xl font-extrabold">Admin sign in</h1>
        <input className="input" placeholder="Username" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required />
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="card p-4"><div className="text-xs uppercase tracking-wider text-muted">{label}</div><div className="mt-1 text-2xl font-extrabold">{value}</div>{hint && <div className="text-xs text-muted">{hint}</div>}</div>;
}

function Overview() {
  const s = useAsync(() => adminApi.stats(), [], 'admin');
  const dramas = useAsync((f) => getDramas(f), [], 'dramabox');
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const st: AdminStats | undefined = s.data;
  const max = Math.max(1, ...(st?.daily.map((d) => d.views) ?? [1]));
  if (s.loading && !st) return <Skel className="h-48 w-full" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total page views" value={st?.visits.toLocaleString() ?? '—'} hint={`${st?.today ?? 0} today`} />
        <Stat label="Dramas in catalogue" value={dramas.data?.length ?? (dramas.loading ? '…' : 'error')} />
        <Stat label="Live channels" value={live.data?.length.toLocaleString() ?? (live.loading ? '…' : 'error')} />
        <Stat label="Managed users / errors" value={`${st?.users ?? 0} / ${st?.errors ?? 0}`} hint={`Server uptime ${Math.floor((st?.uptimeSec ?? 0) / 3600)}h ${Math.floor(((st?.uptimeSec ?? 0) % 3600) / 60)}m`} />
      </div>
      <div className="card p-4">
        <h3 className="font-bold">Page views · last 14 days</h3>
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {st?.daily.map((d) => <div key={d.date} title={`${d.date}: ${d.views}`} className="flex-1 rounded-t grad-bg" style={{ height: `${Math.max(3, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }} />)}
        </div>
      </div>
      <div className="card p-4"><h3 className="font-bold">Top sections</h3>
        {st?.topPaths.length ? <ul className="mt-2 divide-y divide-line/60 text-sm">{st.topPaths.map((p) => <li key={p.path} className="flex justify-between py-1.5"><span>{p.path}</span><span className="text-muted">{p.views}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted">No traffic recorded yet.</p>}</div>
    </div>
  );
}

function ApiStatus() {
  const [rows, setRows] = useState<Record<string, { ok: boolean; ms: number; count: number; error?: string } | 'loading'>>({});
  const [raw, setRaw] = useState<string>('');
  const [rawErr, setRawErr] = useState('');
  const run = useCallback(async () => {
    const keys = Object.keys(IPTV_ENDPOINTS) as EndpointKey[];
    setRows(Object.fromEntries(['dramabox', ...keys].map((k) => [k, 'loading' as const])));
    const t0 = performance.now();
    try { const d = await getDramas(true); setRows((r) => ({ ...r, dramabox: { ok: true, ms: Math.round(performance.now() - t0), count: d.length } })); }
    catch (e) { setRows((r) => ({ ...r, dramabox: { ok: false, ms: Math.round(performance.now() - t0), count: 0, error: (e as Error).message } })); }
    await Promise.all(keys.map(async (k) => { const res = await pingEndpoint(k); setRows((r) => ({ ...r, [k]: res })); }));
  }, []);
  useEffect(() => { run(); }, [run]);
  const inspect = async () => {
    setRaw(''); setRawErr('');
    try { const j = await fetchRawDrama(); setRaw(JSON.stringify(j, null, 2).slice(0, 6000)); } catch (e) { setRawErr((e as Error).message + ' (browser blocked or API unreachable — check CORS and the URL)'); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={run}><Activity size={16} /> Re-check all</button><button className="btn-ghost" onClick={() => { clearCache(); run(); }}>Clear client cache</button></div>
      <div className="card divide-y divide-line/60">
        {Object.entries(rows).map(([k, r]) => (
          <div key={k} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${r === 'loading' ? 'animate-pulse bg-amber-400' : r.ok ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="w-28 font-semibold">{k}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{k === 'dramabox' ? DRAMA_BASE : IPTV_ENDPOINTS[k as EndpointKey]}</span>
            {r !== 'loading' && <span className="text-muted">{r.ok ? `${r.count.toLocaleString()} items · ${r.ms}ms` : r.error}</span>}
          </div>
        ))}
      </div>
      <div className="card p-4">
        <h3 className="font-bold">DramaBox API inspector</h3>
        <p className="mt-1 text-sm text-muted">Shows the raw response so you can verify the field names the adapter in <code>src/services/drama.ts</code> reads.</p>
        <button className="btn-ghost mt-3" onClick={inspect}>Fetch raw response</button>
        {rawErr && <p className="mt-2 text-sm text-red-400">{rawErr}</p>}
        {raw && <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-black/60 p-3 text-xs text-emerald-200">{raw}</pre>}
      </div>
    </div>
  );
}

function Content({ config, setConfig }: { config: PublicConfig; setConfig: (c: PublicConfig) => void }) {
  const dramas = useAsync((f) => getDramas(f), [], 'dramabox');
  const live = useAsync((f) => getLiveChannels(f), [], 'iptv');
  const [q, setQ] = useState(''); const [kind, setKind] = useState<'drama' | 'channel'>('drama'); const [msg, setMsg] = useState('');
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const src = kind === 'drama' ? (dramas.data ?? []).map((d) => ({ id: d.id, title: d.title, image: d.poster })) : (live.data ?? []).map((c) => ({ id: c.id, title: c.name, image: c.logo ?? undefined }));
    return src.filter((x) => !t || x.title.toLowerCase().includes(t)).slice(0, 40);
  }, [q, kind, dramas.data, live.data]);
  const isFeat = (id: string) => config.featured.some((f) => f.type === kind && f.id === id);
  const isHid = (id: string) => config.hidden.includes(`${kind}:${id}`);
  const fail = (e: unknown) => setMsg((e as Error).message);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><button className={`chip ${kind === 'drama' ? 'chip-on' : ''}`} onClick={() => setKind('drama')}>🎬 Dramas</button><button className={`chip ${kind === 'channel' ? 'chip-on' : ''}`} onClick={() => setKind('channel')}>📺 Channels</button>
        <input className="input max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      <p className="text-sm text-muted">Featured items appear in the home carousel. Hidden items are removed from browsing and search for all visitors. {config.featured.length} featured · {config.hidden.length} hidden.</p>
      <div className="card divide-y divide-line/60">
        {items.length === 0 ? <div className="p-4 text-sm text-muted">Nothing to show (still loading, or the API returned no items).</div> : items.map((x) => (
          <div key={x.id} className="flex items-center gap-3 p-2.5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">{x.image && <img src={x.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{x.title}</div><div className="truncate text-xs text-muted">{x.id}</div></div>
            <button className={`btn-ghost !px-2.5 ${isFeat(x.id) ? '!border-brand text-brand' : ''}`} title="Feature" onClick={() => {
              const next = isFeat(x.id) ? config.featured.filter((f) => !(f.type === kind && f.id === x.id)) : [...config.featured, { id: x.id, type: kind, title: x.title, image: x.image }];
              adminApi.saveFeatured(next).then(setConfig).catch(fail);
            }}><Star size={16} className={isFeat(x.id) ? 'fill-current' : ''} /></button>
            <button className={`btn-ghost !px-2.5 ${isHid(x.id) ? '!border-red-500 text-red-400' : ''}`} title="Hide from site" onClick={() => {
              const k = `${kind}:${x.id}`;
              adminApi.saveHidden(isHid(x.id) ? config.hidden.filter((h) => h !== k) : [...config.hidden, k]).then(setConfig).catch(fail);
            }}><EyeOff size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab() {
  const [list, setList] = useState<AdminUser[] | null>(null);
  const [f, setF] = useState({ name: '', email: '', role: 'viewer' as AdminUser['role'] });
  const [err, setErr] = useState('');
  const load = useCallback(() => adminApi.users().then(setList).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <form className="card grid gap-2 p-4 sm:grid-cols-[1fr_1fr_130px_auto]" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await adminApi.addUser(f); setF({ name: '', email: '', role: 'viewer' }); load(); } catch (x) { setErr((x as Error).message); } }}>
        <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AdminUser['role'] })}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
        <button className="btn-primary">Add user</button>
      </form>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {!list ? <Skel className="h-24 w-full" /> : list.length === 0 ? <Empty icon="👥" title="No managed users yet" /> : (
        <div className="card divide-y divide-line/60">
          {list.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1"><div className="font-semibold">{u.name}</div><div className="text-xs text-muted">{u.email} · added {new Date(u.created).toLocaleDateString()}</div></div>
              <select className="input !w-28" value={u.role} onChange={(e) => adminApi.updateUser(u.id, { role: e.target.value as AdminUser['role'] }).then(load)}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
              <button className={`btn-ghost ${u.status === 'suspended' ? '!border-red-500 text-red-400' : ''}`} onClick={() => adminApi.updateUser(u.id, { status: u.status === 'active' ? 'suspended' : 'active' }).then(load)}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
              <button className="btn-ghost" onClick={() => { if (confirm(`Delete ${u.name}?`)) adminApi.deleteUser(u.id).then(load); }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ config, setConfig }: { config: PublicConfig; setConfig: (c: PublicConfig) => void }) {
  const [s, setS] = useState(config.settings); const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  return (
    <form className="card max-w-xl space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); setOk(''); setErr(''); try { setConfig(await adminApi.saveSettings(s)); setOk('Saved.'); } catch (x) { setErr((x as Error).message); } }}>
      <label className="block text-sm font-semibold">Site announcement banner<input className="input mt-1" maxLength={200} placeholder="Leave empty for no banner" value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} /></label>
      <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-yellow-400" checked={s.maintenance} onChange={(e) => setS({ ...s, maintenance: e.target.checked })} /> Maintenance mode (public pages show a maintenance notice; admin stays available)</label>
      {ok && <p className="text-sm text-emerald-400">{ok}</p>}{err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-primary">Save settings</button>
    </form>
  );
}

function Errors() {
  const [list, setList] = useState<ErrorLog[] | null>(null);
  const load = useCallback(() => adminApi.errors().then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><button className="btn-ghost" onClick={load}>Refresh</button><button className="btn-ghost" onClick={() => adminApi.clearErrors().then(load)}>Clear log</button></div>
      {!list ? <Skel className="h-24 w-full" /> : list.length === 0 ? <Empty icon="✅" title="No errors logged" /> : (
        <div className="card divide-y divide-line/60">{list.map((e, i) => (
          <div key={i} className="p-3 text-sm"><div className="flex flex-wrap gap-2 text-xs text-muted"><span>{new Date(e.ts).toLocaleString()}</span><span className="chip !py-0 text-[11px]">{e.source}</span><span>{e.path}</span></div><div className="mt-0.5 break-words">{e.message}</div></div>
        ))}</div>
      )}
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const { config: pub } = useStore();
  const [down, setDown] = useState(false);

  useEffect(() => { adminApi.me().then((r) => setUser(r.username)).catch((e: { status?: number }) => { setUser(null); if (!e.status) setDown(true); }); }, []);
  useEffect(() => { if (user) adminApi.config().then(setConfig).catch(() => setConfig(pub)); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined) return <div className="page"><Skel className="h-48 w-full" /></div>;
  if (!user) return (
    <>
      {down && <div className="page !pb-0"><div className="card p-3 text-sm text-amber-400">Cannot reach the STARR FLIX server. Run <code>npm run dev</code> (or <code>npm start</code>) so the admin API is available.</div></div>}
      <Login onDone={setUser} />
    </>
  );
  return (
    <div className="page">
      <div className="mb-4 flex items-center justify-between gap-3"><h1 className="h-title">Admin dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-muted">Signed in as <b className="text-fg">{user}</b><button className="btn-ghost" onClick={() => adminApi.logout().then(() => setUser(null))}><LogOut size={16} /> Sign out</button></div></div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`chip ${tab === t.id ? 'chip-on' : ''}`}><t.icon size={15} />{t.label}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'api' && <ApiStatus />}
      {tab === 'content' && (config ? <Content config={config} setConfig={setConfig} /> : <Skel className="h-48 w-full" />)}
      {tab === 'users' && <UsersTab />}
      {tab === 'settings' && (config ? <SettingsTab config={config} setConfig={setConfig} /> : <Skel className="h-48 w-full" />)}
      {tab === 'errors' && <Errors />}
    </div>
  );
}
