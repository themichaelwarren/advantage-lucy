import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Text kept in the address (e.g. ?q=…) so it can be linked to, without
 * breaking typing. The input works from its own state; the address is
 * updated shortly after typing pauses. Writing the address on every key
 * re-renders the input from the URL a moment later, which breaks Japanese
 * IME conversion (half-converted text gets duplicated).
 */
export function useQueryParam(key: string, delay = 300): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(key) || '';
  const [value, setValue] = useState(fromUrl);
  const lastWritten = useRef(fromUrl);

  // Address changed from outside (a link to ?q=…, back/forward): follow it
  useEffect(() => {
    if (fromUrl !== lastWritten.current) {
      lastWritten.current = fromUrl;
      setValue(fromUrl);
    }
  }, [fromUrl]);

  // Our typing: write it to the address once typing pauses
  useEffect(() => {
    if (value === lastWritten.current) return;
    const t = window.setTimeout(() => {
      lastWritten.current = value;
      setParams(prev => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value); else next.delete(key);
        return next;
      }, { replace: true });
    }, delay);
    return () => window.clearTimeout(t);
  }, [value, key, delay, setParams]);

  return [value, setValue];
}
