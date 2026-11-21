import { useCallback, useEffect, useRef, useState } from 'react';
import { reportError } from './report';

export function useAsync<T>(fn: (force: boolean) => Promise<T>, deps: unknown[] = [], label = 'api') {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const force = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let live = true;
    const f = force.current; force.current = false;
    setState((s) => ({ data: s.data, loading: true }));
    fnRef.current(f)
      .then((data) => live && setState({ data, loading: false }))
      .catch((error: Error) => {
        reportError(error.message, label);
        if (live) setState({ error, loading: false });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => { force.current = true; setTick((t) => t + 1); }, []);
  return { ...state, reload };
}
