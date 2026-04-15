import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotos } from '../hooks/useSheetData';
import type { SplashPhoto } from '../types';

function pickRandom<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export default function Splash() {
  const navigate = useNavigate();
  const { photos, loading } = usePhotos();
  const [picks, setPicks] = useState<SplashPhoto[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (photos.length > 0 && !pickedRef.current) {
      pickedRef.current = true;
      setPicks(pickRandom(photos, 1));
    }
  }, [photos]);

  // Preload images
  useEffect(() => {
    if (picks.length === 0) return;
    setLoadedCount(0);
    picks.forEach(p => {
      const img = new Image();
      img.onload = () => setLoadedCount(c => c + 1);
      img.onerror = () => setLoadedCount(c => c + 1);
      img.src = p.image_url;
    });
  }, [picks]);

  function enter() {
    const locale = navigator.language.startsWith('ja') ? 'ja' : 'en';
    navigate(`/${locale}/`);
  }

  const ready = !loading && picks.length > 0 && loadedCount >= picks.length;
  const bgPhoto = picks[0];

  return (
    <div
      className={`splash ${ready ? 'splash-ready' : ''}`}
      onClick={enter}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && enter()}
      style={ready && bgPhoto ? { backgroundImage: `url(${bgPhoto.image_url})` } : undefined}
    >
      <div className="splash-overlay" />

      {picks.length > 0 && (
        <div className="splash-pile" aria-hidden="true">
          {picks.map((p, i) => (
            <div key={p.id} className={`splash-polaroid splash-polaroid-${i + 1}`}>
              <img src={p.image_url} alt="" />
            </div>
          ))}
        </div>
      )}

      <span className="splash-logo band-name">advantage Lucy</span>
      <div className="splash-enter">click to enter</div>
    </div>
  );
}
