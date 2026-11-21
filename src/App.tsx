import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './context/Store';
import Home from './pages/Home';
import LiveTV from './pages/LiveTV';
import DramaBox from './pages/DramaBox';
import DramaDetail from './pages/DramaDetail';
import { Movies, Sports } from './pages/ChannelBrowse';
import TVGuide from './pages/TVGuide';
import Categories from './pages/Categories';
import SearchPage from './pages/Search';
import { Watchlist, WatchHistory } from './pages/Library';
import { About, Contact, NotFound } from './pages/Static';
import { Skel } from './components/Ui';

const Admin = lazy(() => import('./pages/Admin'));

function Maintenance() {
  return (
    <div className="page grid min-h-[50vh] place-items-center text-center">
      <div><div className="text-5xl">🛠️</div><h1 className="mt-3 text-2xl font-extrabold">We&apos;ll be right back</h1>
        <p className="mt-1 text-muted">STARR FLIX is undergoing scheduled maintenance.</p></div>
    </div>
  );
}

export default function App() {
  const { config } = useStore();
  const maintenance = config.settings.maintenance;
  const wrap = (el: JSX.Element) => <ErrorBoundary inline>{el}</ErrorBoundary>;
  return (
    <Layout>
      <Routes>
        <Route path="/admin/*" element={
          <Suspense fallback={<div className="page"><Skel className="h-64 w-full" /></div>}>{wrap(<Admin />)}</Suspense>
        } />
        {maintenance ? (
          <Route path="*" element={<Maintenance />} />
        ) : (
          <>
            <Route path="/" element={wrap(<Home />)} />
            <Route path="/live" element={wrap(<LiveTV />)} />
            <Route path="/dramabox" element={wrap(<DramaBox />)} />
            <Route path="/drama/:id" element={wrap(<DramaDetail />)} />
            <Route path="/movies" element={wrap(<Movies />)} />
            <Route path="/sports" element={wrap(<Sports />)} />
            <Route path="/guide" element={wrap(<TVGuide />)} />
            <Route path="/categories" element={wrap(<Categories />)} />
            <Route path="/search" element={wrap(<SearchPage />)} />
            <Route path="/watchlist" element={wrap(<Watchlist />)} />
            <Route path="/history" element={wrap(<WatchHistory />)} />
            <Route path="/about" element={wrap(<About />)} />
            <Route path="/contact" element={wrap(<Contact />)} />
            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>
    </Layout>
  );
}
