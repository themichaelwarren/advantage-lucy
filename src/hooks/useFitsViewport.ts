import { useEffect, useRef, useState } from 'react';

/**
 * True while the element (plus a top offset) fits inside the window.
 * Used to make side panels sticky only when that won't hide their bottom.
 */
export function useFitsViewport<T extends HTMLElement>(offsetPx = 112) {
  const ref = useRef<T>(null);
  const [fits, setFits] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setFits(el.scrollHeight + offsetPx <= window.innerHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener('resize', check);
    // Images (the flyer) change the height once they load
    el.querySelectorAll('img').forEach(img => img.addEventListener('load', check));
    return () => { ro.disconnect(); window.removeEventListener('resize', check); };
  });
  return { ref, fits };
}
