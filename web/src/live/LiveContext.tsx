import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchHealth, type Health } from './api';

/** The model server's health, or null while it isn't running. Checked every few seconds. */
const LiveContext = createContext<Health | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let active = true;
    const check = () => fetchHealth().then((h) => active && setHealth(h));
    check();
    const timer = window.setInterval(check, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  return <LiveContext.Provider value={health}>{children}</LiveContext.Provider>;
}

export function useLive(): Health | null {
  return useContext(LiveContext);
}
