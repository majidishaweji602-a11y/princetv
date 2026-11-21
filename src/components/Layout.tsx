import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Clapperboard, Facebook, Heart, History, Home, Instagram, Mail, Menu, MessageCircle, Moon, Music2,
  Search, Star, Sun, Tv, User, X, Youtube, Film, Trophy, CalendarDays, LayoutGrid, Info, Phone, Shield,
} from 'lucide-react';
import { useStore } from '../context/Store';
import { BRAND, CONTACT_EMAIL, DEV, SOCIALS } from '../lib/constants';
import { getDramas } from '../services/drama';
import { getLiveChannels } from '../services/iptv';
import { trackView } from '../lib/report';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/live', label: 'Live TV', icon: Tv },
  { to: '/dramabox', label: 'DramaBox', icon: Clapperboard },
  { to: '/movies', label: 'Movies', icon: Film },
  { to: '/sports', label: 'Sports', icon: Trophy },
  { to: '/guide', label: 'TV Guide', icon: CalendarDays },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
];
const MORE = [
  { to: '/watchlist', label: 'My Watchlist', icon: Heart },
  { to: '/history', label: 'Watch History', icon: History },
  { to: '/about', label: 'About Us', icon: Info },
  { to: '/contact', label: 'Contact', icon: Phone },
  { to: '/admin', label: 'Admin', icon: Shield },
];

export function BrandMark({ className = 'h-9 w-9', icon = 18 }: { className?: string; icon?: number }) {
  return <span className={`grid shrink-0 place-items-center rounded-full border-[3px] border-brand bg-black text-brand ${className}`}><Star size={icon} fill="currentColor" /></span>;
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label={BRAND}>
      <BrandMark className={size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'} icon={size === 'lg' ? 22 : 18} />
      <span className={`font-extrabold tracking-wide text-brand ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>STARR FLIX</span>
    </Link>
  );
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<{ label: string; kind: 'drama' | 'channel' }[]>([]);
  const loaded = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  const ensure = () => {
    if (loaded.current) return; loaded.current = true;
    Promise.allSettled([getDramas(), getLiveChannels()]).then(([d, c]) => {
      const out: { label: string; kind: 'drama' | 'channel' }[] = [];
      if (d.status === 'fulfilled') d.value.forEach((x) => out.push({ label: x.title, kind: 'drama' }));
      if (c.status === 'fulfilled') c.value.forEach((x) => out.push({ label: x.name, kind: 'channel' }));
      setNames(out);
    });
  };
  const sugg = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const starts: typeof names = [], has: typeof names = [];
    for (const n of names) {
      const l = n.label.toLowerCase();
      if (l.startsWith(t)) starts.push(n); else if (l.includes(t)) has.push(n);
      if (starts.length >= 8) break;
    }
    const seen = new Set<string>();
    return [...starts, ...has].filter((n) => (seen.has(n.label) ? false : (seen.add(n.label), true))).slice(0, 7);
  }, [q, names]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const go = (term: string) => { if (!term.trim()) return; nav(`/search?q=${encodeURIComponent(term.trim())}`); setOpen(false); onDone?.(); };

  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} role="search">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Search dramas & channels…" value={q}
          onFocus={() => { ensure(); setOpen(true); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      </form>
      {open && sugg.length > 0 && (
        <ul className="glass absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl shadow-2xl">
          {sugg.map((s) => (
            <li key={s.kind + s.label}>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand/15" onClick={() => go(s.label)}>
                <span>{s.kind === 'drama' ? '🎬' : '📺'}</span><span className="truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Navbar() {
  const { theme, toggleTheme, favs } = useStore();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  return (
    <header className="glass sticky top-0 z-40 hidden border-x-0 border-t-0 md:block">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 xl:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:text-fg'}`}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-xs md:block"><SearchBox /></div>
        <Link to="/watchlist" className="btn-ghost relative !px-2.5 max-md:ml-auto" aria-label="Watchlist">
          <Heart size={18} />{favs.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full grad-bg px-1 text-[10px] text-black">{favs.length}</span>}
        </Link>
        <button className="btn-ghost !px-2.5" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="btn-ghost !px-2.5 xl:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu">{menu ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {menu && (
        <div className="border-t border-line/70 px-4 pb-4 pt-3 xl:hidden">
          <div className="mb-3 md:hidden"><SearchBox onDone={() => setMenu(false)} /></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...NAV, ...MORE].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex items-center gap-2 rounded-xl border border-line/70 px-3 py-2.5 text-sm ${isActive ? 'border-brand bg-brand/15' : 'bg-surface/50'}`}>
                <n.icon size={16} />{n.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function MobileHeader() {
  const { theme, toggleTheme } = useStore();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  return (
    <header className="px-4 pb-1 pt-4 md:hidden">
      <div className="flex items-center gap-3">
        <Link to="/" aria-label={BRAND} className="flex min-w-0 flex-1 items-center gap-3.5">
          <BrandMark className="h-14 w-14" icon={26} />
          <span className="min-w-0">
            <span className="block truncate text-[28px] font-extrabold uppercase leading-none tracking-wider text-brand">{BRAND}</span>
            <span className="mt-1.5 block truncate text-base tracking-wider text-muted">Burudani Bila Kikomo</span>
          </span>
        </Link>
        <button onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line bg-surface text-brand">
          {menu ? <X size={24} /> : <User size={24} fill="currentColor" />}
        </button>
      </div>
      {menu && (
        <div className="mt-3 rounded-2xl border border-line/70 bg-surface p-3">
          <SearchBox onDone={() => setMenu(false)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[...NAV, ...MORE].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${isActive ? 'border-brand text-brand' : 'border-line/70'}`}>
                <n.icon size={16} />{n.label}
              </NavLink>
            ))}
            <button onClick={toggleTheme} className="flex items-center gap-2 rounded-xl border border-line/70 px-3 py-2.5 text-sm">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}{theme === 'dark' ? 'Mwanga' : 'Giza'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function BottomNav() {
  const items = [
    { to: '/', label: 'Mwanzo', icon: Home },
    { to: '/live', label: 'Live TV', icon: Tv },
    { to: '/movies', label: 'Movies', icon: Film },
    { to: '/dramabox', label: 'Drama', icon: Clapperboard },
    { to: '/watchlist', label: 'Orodha', icon: Heart },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Bottom">
      <div className="grid grid-cols-5 gap-1 px-1.5 py-2">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[13px] font-semibold tracking-wide transition ${isActive ? 'bg-surface text-brand' : 'text-muted'}`}>
            <n.icon size={26} fill={'currentColor'} fillOpacity={0} />{n.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  const links = [
    { href: SOCIALS.youtube, label: 'YouTube', icon: Youtube },
    { href: SOCIALS.tiktok, label: 'TikTok', icon: Music2 },
    { href: SOCIALS.facebook, label: 'Facebook', icon: Facebook },
    { href: SOCIALS.instagram, label: 'Instagram', icon: Instagram },
    { href: SOCIALS.whatsapp, label: 'WhatsApp', icon: MessageCircle },
  ];
  return (
    <footer className="mt-12 border-t border-line/70 bg-surface/40 pb-28 backdrop-blur md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-3 font-semibold">Entertainment without limits.</p>
            <p className="mt-1 text-sm text-muted">An Entertainment Platform by {DEV}.</p>
            <p className="text-sm text-muted">Developed &amp; Powered by {DEV}.</p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Explore</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {[...NAV.slice(1), ...MORE.slice(0, 4)].map((n) => <li key={n.to}><Link className="hover:text-brand" to={n.to}>{n.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Connect</h3>
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label} className="btn-ghost !p-2.5 hover:text-brand"><l.icon size={18} /></a>
              ))}
            </div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-flex items-center gap-2 text-sm hover:text-brand"><Mail size={16} />{CONTACT_EMAIL}</a>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-1 border-t border-line/70 pt-4 text-xs text-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND}. All rights reserved.</span>
          <span>Streams and catalogue are supplied by third-party APIs; availability and licensing are set by their providers.</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { config } = useStore();
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); trackView(loc.pathname); }, [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      {config.settings.announcement && (
        <div className="grad-bg px-4 py-1.5 text-center text-sm font-medium text-black">{config.settings.announcement}</div>
      )}
      <Navbar />
      <MobileHeader />
      <main className="flex-1" key={loc.pathname}>{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
