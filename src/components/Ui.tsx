import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';

export function Skel({ className = '' }: { className?: string }) { return <div className={`skel ${className}`} />; }

export function CardSkeletons({ n = 8, ratio = 'aspect-[2/3]' }: { n?: number; ratio?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}><Skel className={`${ratio} w-full`} /><Skel className="mt-2 h-3 w-3/4" /></div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "Couldn't load this content" }: { message?: string; onRetry?: () => void; title?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <AlertTriangle className="text-amber-400" />
      <div className="font-semibold">{title}</div>
      {message && <div className="max-w-md text-sm text-muted">{message}</div>}
      {onRetry && <button className="btn-primary mt-2" onClick={onRetry}><RefreshCw size={16} /> Retry</button>}
    </div>
  );
}

export function Empty({ icon = '🎞️', title, hint, children }: { icon?: string; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-10 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-muted">{hint}</div>}
      {children}
    </div>
  );
}

export function SeeAll({ to, label = 'Zote' }: { to: string; label?: string }) {
  return <Link to={to} className="see-all">{label} <ChevronRight size={18} /></Link>;
}

export function Section({ title, action, live, children }: { title: ReactNode; action?: ReactNode; live?: boolean; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="h-title flex items-center gap-2.5">{live && <i className="h-3 w-3 shrink-0 rounded-full bg-red-500" />}{title}</h2>{action}
      </div>
      {children}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{children}</div>;
}
