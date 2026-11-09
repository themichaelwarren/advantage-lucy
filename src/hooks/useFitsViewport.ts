import { useEffect, useRef, useState } from 'react';

/**
 * Sticky side panels that never hide their bottom.
 * `top` is where the panel should stick: normally `offsetPx` from the top,
 * but for a panel taller than the window, high enough that its bottom stays
 * in view. So a tall panel (a long title and a flyer) scrolls with the page
 * until its bottom shows, then stays put while the other column scrolls on.
 * `fits` says whether the whole panel fits in the window.
 */
export function useFitsViewport<T extends HTMLElement>(offsetPx = 96, bottomGapPx = 16) {
  const ref = useRef<T>(null);
  const [state, setState] = useState({ fits: true, top: offsetPx });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const h = el.scrollHeight;
      const room = window.innerHeight - bottomGapPx;
      const top = Math.min(offsetPx, room - h);
      setState(s => (s.top === top && s.fits === (h + offsetPx <= room) ? s : { fits: h + offsetPx <= room, top }));
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener('resize', check);
    // Images (the flyer) change the height once they load
    el.querySelectorAll('img').forEach(img => img.addEventListener('load', check));
    return () => { ro.disconnect(); window.removeEventListener('resize', check); };
  });
  return { ref, ...state };
}
