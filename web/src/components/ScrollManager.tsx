import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scrolls to #hash targets after navigation, otherwise to the top on route change. */
export function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
