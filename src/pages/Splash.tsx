import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotos } from '../hooks/useSheetData';
import type { SplashPhoto } from '../types';

const SCATTER = [
  // Back layer — fill gaps
  { top: '5%',   left: '20%',  rotate: 1,    z: 0 },
  { top: '25%',  left: '25%',  rotate: -2,   z: 0 },
  { top: '50%',  left: '20%',  rotate: 3,    z: 0 },
  { top: '72%',  left: '25%',  rotate: -1,   z: 0 },
  // Main layer
  { top: '-5%',  left: '-6%',  rotate: -3,   z: 2 },
  { top: '-3%',  left: '40%',  rotate: 4,    z: 1 },
  { top: '14%',  left: '18%',  rotate: 5,    z: 4 },
  { top: '17%',  left: '-10%', rotate: -2,   z: 3 },
  { top: '30%',  left: '44%',  rotate: -4.5, z: 5 },
  { top: '35%',  left: '5%',   rotate: 3,    z: 6 },
  { top: '48%',  left: '38%',  rotate: 2,    z: 8 },
  { top: '46%',  left: '-8%',  rotate: -3.5, z: 7 },
  { top: '60%',  left: '15%',  rotate: 4.5,  z: 10 },
  { top: '63%',  left: '46%',  rotate: -2,   z: 9 },
  { top: '76%',  left: '-5%',  rotate: -1.5, z: 11 },
  { top: '80%',  left: '42%',  rotate: 3.5,  z: 12 },
];

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
      // Use all photos, repeating if needed to fill the grid
      const shuffled = pickRandom(photos, photos.length);
      const filled: SplashPhoto[] = [];
      for (let i = 0; i < SCATTER.length; i++) {
        filled.push(shuffled[i % shuffled.length]);
      }
      setPicks(filled);
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
          {picks.map((p, i) => {
            const s = SCATTER[i % SCATTER.length];
            return (
              <div
                key={p.id}
                className="splash-polaroid"
                style={{
                  top: s.top,
                  left: s.left,
                  transform: `rotate(${s.rotate}deg)`,
                  zIndex: s.z,
                }}
              >
                <img src={p.image_url} alt="" />
              </div>
            );
          })}
        </div>
      )}

      <span className="splash-logo band-name">advantage Lucy</span>
      <div className="splash-enter">click to enter</div>
    </div>
  );
}
