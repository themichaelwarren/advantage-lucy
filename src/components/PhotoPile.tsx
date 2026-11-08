import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '../i18n/translations';
import type { SplashPhoto } from '../types';
import { ACCENTS } from '../utils/palette';

interface Props {
  photos: SplashPhoto[];
  locale: Locale;
}

const REVEAL_MS = 650;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextColour(current: string) {
  const choices = ACCENTS.filter(c => c !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Home-page photo. → (or tapping the photo) shows a new random photo; ←
 * goes back through the ones already seen. New photos come from a shuffled
 * deck, so every photo shows once before any repeats. Each change opens
 * the new photo out in a circle from where you tapped, and the card's
 * shadow changes colour.
 */
export default function PhotoPile({ photos, locale }: Props) {
  const deck = useRef<SplashPhoto[]>([]);
  // Photos shown so far, and which one is on screen (for going back)
  const [history, setHistory] = useState<SplashPhoto[]>([]);
  const [pos, setPos] = useState(0);
  // The previous photo stays underneath while the new one opens out over it
  const [under, setUnder] = useState<SplashPhoto | null>(null);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [changes, setChanges] = useState(0);
  const [mat, setMat] = useState(() => ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
  const busy = useRef(false);

  const draw = useCallback((exclude?: string) => {
    if (deck.current.length === 0) {
      deck.current = shuffle(photos);
      // Never show the same photo twice in a row across a reshuffle
      if (exclude && deck.current.length > 1 && deck.current[0].id === exclude) {
        deck.current.push(deck.current.shift()!);
      }
    }
    const next = deck.current.shift()!;
    // Warm the cache for the photo after this one
    if (deck.current[0]) new Image().src = deck.current[0].image_url;
    return next;
  }, [photos]);

  useEffect(() => {
    if (photos.length === 0) return;
    deck.current = [];
    setHistory([draw()]);
    setPos(0);
  }, [photos, draw]);

  const current = history[pos];

  const go = useCallback((dir: 1 | -1, x = 50, y = 50) => {
    if (!current || busy.current || photos.length < 2) return;
    if (dir === -1 && pos === 0) return;
    busy.current = true;
    setUnder(current);
    setOrigin({ x, y });
    if (dir === -1) {
      setPos(p => p - 1);
    } else if (pos < history.length - 1) {
      setPos(p => p + 1); // forward again after going back
    } else {
      setHistory(h => [...h, draw(current.id)]);
      setPos(p => p + 1);
    }
    setChanges(n => n + 1);
    setMat(m => nextColour(m));
    window.setTimeout(() => {
      setUnder(null);
      busy.current = false;
    }, REVEAL_MS);
  }, [current, draw, history.length, photos.length, pos]);

  if (!current) return <div className="photo-pile photo-pile-empty" aria-hidden="true" />;

  const caption = locale === 'ja' ? current.caption_ja || current.caption_en : current.caption_en || current.caption_ja;
  const t = locale === 'ja'
    ? { prev: '前の写真', next: '次の写真', label: 'バンドの写真' }
    : { prev: 'Previous photo', next: 'Next photo', label: 'Band photos' };

  /** Where on the photo a click landed, as % (so the reveal starts there). */
  const pointIn = (e: React.MouseEvent, el: Element | null) => {
    const r = el?.getBoundingClientRect();
    if (!r || e.detail === 0) return { x: 50, y: 50 }; // keyboard: from the centre
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  return (
    <section
      className="photo-pile"
      style={{ '--mat': mat } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label={t.label}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      }}
    >
      <div className="photo-pile-stage">
        {/* Tapping the photo itself also shows the next one */}
        <div
          className="photo-pile-frame"
          onClick={e => { const p = pointIn(e, e.currentTarget); go(1, p.x, p.y); }}
        >
          {under && <img className="photo-pile-img" src={under.image_url} alt="" aria-hidden="true" />}
          <img
            key={`${current.id}-${changes}`}
            className={`photo-pile-img${changes > 0 ? ' photo-pile-img-reveal' : ''}`}
            style={{ '--ox': `${origin.x}%`, '--oy': `${origin.y}%` } as React.CSSProperties}
            src={current.image_url}
            alt={caption || ''}
          />
        </div>

        <div className="photo-pile-meta">
          <span aria-live="polite">{caption && <span className="photo-pile-caption">{caption}</span>}</span>
          <span className="photo-pile-arrows">
            <button
              type="button"
              className="photo-pile-arrow"
              onClick={e => { const p = pointIn(e, e.currentTarget.closest('.photo-pile-stage')); go(-1, p.x, p.y); }}
              disabled={pos === 0}
              aria-label={t.prev}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button
              type="button"
              className="photo-pile-arrow"
              onClick={e => { const p = pointIn(e, e.currentTarget.closest('.photo-pile-stage')); go(1, p.x, p.y); }}
              aria-label={t.next}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}
