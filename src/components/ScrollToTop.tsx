import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * A new page starts at the top. Without this, tapping a link after
 * scrolling (say, the next show on the home page) opens the new page at the
 * old scroll position, with its heading under the sticky header.
 * Left alone: Back/Forward (the browser keeps your place), #links, and
 * changes to the same page's filters (?q=…, ?tab=…).
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type === 'POP' || hash) return;
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}
