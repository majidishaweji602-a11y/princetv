import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Fav, HistItem, Progress, PublicConfig } from '../types';
import { EMPTY_CONFIG, getPublicConfig } from '../services/admin';

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem('sf:' + key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem('sf:' + key, JSON.stringify(v)); } catch { /* ignore */ }
}

interface Store {
  theme: 'dark' | 'light'; toggleTheme: () => void;
  favs: Fav[]; isFav: (type: Fav['type'], id: string) => boolean; toggleFav: (f: Omit<Fav, 'key'>) => void;
  history: HistItem[]; addHistory: (h: Omit<HistItem, 'key' | 'ts'>) => void; removeHistory: (key: string) => void; clearHistory: () => void;
  progress: Progress[]; saveProgress: (p: Omit<Progress, 'ts'>) => void; removeProgress: (dramaId: string) => void;
  getProgress: (dramaId: string) => Progress | undefined;
  config: PublicConfig; isHidden: (type: string, id: string) => boolean;
}
const Ctx = createContext<Store | null>(null);
export const useStore = () => { const c = useContext(Ctx); if (!c) throw new Error('Store missing'); return c; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => load('theme', 'dark'));
  const [favs, setFavs] = useState<Fav[]>(() => load('favs', []));
  const [history, setHistory] = useState<HistItem[]>(() => load('history', []));
  const [progress, setProgress] = useState<Progress[]>(() => load('progress', []));
  const [config, setConfig] = useState<PublicConfig>(EMPTY_CONFIG);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    save('theme', theme);
  }, [theme]);
  useEffect(() => { getPublicConfig().then(setConfig); }, []);
  useEffect(() => save('favs', favs), [favs]);
  useEffect(() => save('history', history), [history]);
  useEffect(() => save('progress', progress), [progress]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const isFav = useCallback((type: Fav['type'], id: string) => favs.some((f) => f.key === `${type}:${id}`), [favs]);
  const toggleFav = useCallback((f: Omit<Fav, 'key'>) => {
    const key = `${f.type}:${f.id}`;
    setFavs((cur) => (cur.some((x) => x.key === key) ? cur.filter((x) => x.key !== key) : [{ ...f, key }, ...cur]));
  }, []);
  const addHistory = useCallback((h: Omit<HistItem, 'key' | 'ts'>) => {
    const key = `${h.type}:${h.id}`;
    setHistory((cur) => [{ ...h, key, ts: Date.now() }, ...cur.filter((x) => x.key !== key)].slice(0, 100));
  }, []);
  const removeHistory = useCallback((key: string) => setHistory((c) => c.filter((x) => x.key !== key)), []);
  const clearHistory = useCallback(() => setHistory([]), []);
  const saveProgress = useCallback((p: Omit<Progress, 'ts'>) => {
    setProgress((cur) => [{ ...p, ts: Date.now() }, ...cur.filter((x) => x.dramaId !== p.dramaId)].slice(0, 30));
  }, []);
  const removeProgress = useCallback((id: string) => setProgress((c) => c.filter((x) => x.dramaId !== id)), []);
  const getProgress = useCallback((id: string) => progress.find((p) => p.dramaId === id), [progress]);
  const isHidden = useCallback((type: string, id: string) => config.hidden.includes(`${type}:${id}`), [config]);

  const value = useMemo(() => ({
    theme, toggleTheme, favs, isFav, toggleFav, history, addHistory, removeHistory, clearHistory,
    progress, saveProgress, removeProgress, getProgress, config, isHidden,
  }), [theme, toggleTheme, favs, isFav, toggleFav, history, addHistory, removeHistory, clearHistory, progress, saveProgress, removeProgress, getProgress, config, isHidden]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
