import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import type { Slide } from '../utils/photoLinks';
import { ACCENTS } from '../utils/palette';

interface Props {
  slides: Slide[];
  locale: Locale;
}

const REVEAL_MS = 650;
/** How long each photo stays before the next one, when nobody's touching it */
const AUTO_MS = 6500;

function nextColour(current: string) {
  const choices = ACCENTS.filter(c => c !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * The average colour down an image's left and right edges, for filling the
 * space beside a flyer so it reads as one picture. Null when the image
 * can't be read (another site's image without permission): the blurred
 * copy is used then.
 */
function edgeColours(img: HTMLImageElement): [string, string] | null {
  try {
    const h = 64;
    const w = Math.max(2, Math.round((img.naturalWidth / img.naturalHeight) * h));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const avg = (x: number) => {
      const d = ctx.getImageData(x, 0, 2, h).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})`;
    };
    return [avg(1), avg(w - 3)];
  } catch {
    return null;
  }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Home-page carousel. Photos go in the order set in the admin (the sheet's
 * row order), moving on by themselves every few seconds; it pauses while
 * the pointer or keyboard focus is on it, and doesn't move at all for
 * people who've asked for less motion. ← → (or the keys) step through and
 * wrap around. Each change opens the new photo out in a circle and changes
 * the card's shadow colour.
 *
 * A photo with a link: the caption is a button to it, and tapping the photo
 * goes there too. Without a link, tapping the photo shows the next one.
 * Flyers (photos linked to a show) and tall images are shown whole on a
 * blurred copy of themselves rather than cropped.
 */
export default function PhotoPile({ slides, locale }: Props) {
  const [pos, setPos] = useState(0);
  // The previous photo stays underneath while the new one opens out over it
  const [under, setUnder] = useState<Slide | null>(null);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [changes, setChanges] = useState(0);
  const [mat, setMat] = useState(() => ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
  const [paused, setPaused] = useState(false);
  const [tall, setTall] = useState<Record<string, boolean>>({});
  const [edges, setEdges] = useState<Record<string, [string, string] | null>>({});
  const busy = useRef(false);

  const n = slides.length;
  // Keep the position valid if the list changes
  useEffect(() => { setPos(p => (p < n ? p : 0)); }, [n]);
  const current = slides[pos] ?? slides[0];

  const go = useCallback((dir: 1 | -1, x = 50, y = 50) => {
    if (!current || busy.current || n < 2) return;
    busy.current = true;
    setUnder(current);
    setOrigin({ x, y });
    setPos(p => (p + dir + n) % n);
    setChanges(c => c + 1);
    setMat(m => nextColour(m));
    window.setTimeout(() => {
      setUnder(null);
      busy.current = false;
    }, REVEAL_MS);
  }, [current, n]);

  // Warm the cache for the next photo
  useEffect(() => {
    const next = slides[(pos + 1) % Math.max(n, 1)];
    if (next) new Image().src = next.image_url;
  }, [pos, slides, n]);

  // Move on by itself. Restarts after every change, so a tap gets a full turn.
  useEffect(() => {
    if (n < 2 || paused || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => { if (!document.hidden) go(1); }, AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [pos, paused, n, go]);

  if (!current) return <div className="photo-pile photo-pile-empty" aria-hidden="true" />;

  const t = locale === 'ja'
    ? { prev: '前の写真', next: '次の写真', label: '写真', of: (i: number) => `${i + 1} / ${n}` }
    : { prev: 'Previous photo', next: 'Next photo', label: 'Photos', of: (i: number) => `${i + 1} of ${n}` };

  /** Where on the photo a click landed, as % (so the reveal starts there). */
  const pointIn = (e: React.MouseEvent, el: Element | null) => {
    const r = el?.getBoundingClientRect();
    if (!r || e.detail === 0) return { x: 50, y: 50 }; // keyboard: from the centre
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  const noteShape = (s: Slide) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Anything noticeably taller than the 3:2 frame would lose its top and bottom
    const isTall = img.naturalWidth / img.naturalHeight < 1.35;
    setTall(m => (m[s.id] === isTall ? m : { ...m, [s.id]: isTall }));
    if ((s.fit || isTall) && !(s.id in edges)) setEdges(m => ({ ...m, [s.id]: edgeColours(img) }));
  };

  /** One photo: tall ones get a blurred copy behind so they show whole. */
  const picture = (s: Slide, extra: { className?: string; style?: React.CSSProperties; hidden?: boolean }) => {
    const fit = s.fit || tall[s.id];
    const edge = fit ? edges[s.id] : undefined;
    return (
    <div
      key={extra.hidden ? `under-${s.id}` : `${s.id}-${changes}`}
      className={`photo-pile-img${fit ? ' is-tall' : ''}${extra.className ? ` ${extra.className}` : ''}`}
      style={edge ? { ...extra.style, background: `linear-gradient(to right, ${edge[0]} 50%, ${edge[1]} 50%)` } : extra.style}
      aria-hidden={extra.hidden || undefined}
    >
      {fit && !edge && <img className="photo-pile-blur" src={s.image_url} alt="" aria-hidden="true" />}
      <img src={s.image_url} alt={extra.hidden ? '' : s.label || ''} onLoad={noteShape(s)} draggable={false} />
    </div>
    );
  };

  const shown = picture(current, {
    className: changes > 0 ? 'photo-pile-img-reveal' : undefined,
    style: { '--ox': `${origin.x}%`, '--oy': `${origin.y}%` } as React.CSSProperties,
  });

  const caption = current.label && (
    current.href
      ? current.external
        ? <a className="photo-pile-caption is-link" href={current.href} target="_blank" rel="noopener noreferrer">{current.label} <span aria-hidden="true">↗</span></a>
        : <Link className="photo-pile-caption is-link" to={current.href}>{current.label} <span aria-hidden="true">→</span></Link>
      : <span className="photo-pile-caption">{current.label}</span>
  );

  return (
    <section
      className="photo-pile"
      style={{ '--mat': mat } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label={t.label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false); }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      }}
    >
      <div className="photo-pile-stage">
        {/* Tapping the photo follows its link, or else shows the next one.
            (The caption is the keyboard/screen-reader way to the link.) */}
        {current.href ? (
          current.external
            ? <a className="photo-pile-frame" href={current.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">{under && picture(under, { hidden: true })}{shown}</a>
            : <Link className="photo-pile-frame" to={current.href} tabIndex={-1} aria-hidden="true">{under && picture(under, { hidden: true })}{shown}</Link>
        ) : (
          <div className="photo-pile-frame" onClick={e => { const p = pointIn(e, e.currentTarget); go(1, p.x, p.y); }}>
            {under && picture(under, { hidden: true })}
            {shown}
          </div>
        )}

        <div className="photo-pile-meta">
          <span aria-live={paused ? 'polite' : 'off'}>
            {caption}
            {n > 1 && <span className="visually-hidden">{t.of(pos)}</span>}
          </span>
          {n > 1 && (
            <span className="photo-pile-arrows">
              <button
                type="button"
                className="photo-pile-arrow"
                onClick={e => { const p = pointIn(e, e.currentTarget.closest('.photo-pile-stage')); go(-1, p.x, p.y); }}
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
          )}
        </div>
      </div>
      {n > 1 && (
        <div className="photo-pile-dots" aria-hidden="true">
          {slides.map((s, i) => <span key={s.id} className={i === pos ? 'is-on' : ''} />)}
        </div>
      )}
    </section>
  );
}
