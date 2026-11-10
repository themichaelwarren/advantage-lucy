import { useEffect, useRef } from 'react';

/**
 * A YouTube player for the admin (privacy-enhanced embed), with a handle
 * to read where it is and jump: used to set and check song start times.
 */
export interface PlayerHandle {
  time: () => number;
  seek: (seconds: number) => void;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
interface YTPlayer {
  getCurrentTime: () => number;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  loadVideoById: (o: { videoId: string; startSeconds?: number }) => void;
  destroy: () => void;
}

let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiReady) return apiReady;
  apiReady = new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiReady;
}

export default function YouTubePlayer({ videoId, start, autoplay, onReady, title }: {
  videoId: string;
  start?: number | null;
  autoplay?: boolean;
  onReady?: (handle: PlayerHandle | null) => void;
  title?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let alive = true;
    loadApi().then(() => {
      if (!alive || !host.current || !window.YT) return;
      const el = document.createElement('div');
      host.current.replaceChildren(el);
      player.current = new window.YT.Player(el, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { start: start ? Math.floor(start) : undefined, autoplay: autoplay ? 1 : 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            const p = player.current;
            if (!alive || !p) return;
            ready.current?.({
              time: () => p.getCurrentTime() || 0,
              seek: (sec: number) => { p.seekTo(sec, true); p.playVideo(); },
            });
          },
        },
      });
    });
    return () => {
      alive = false;
      ready.current?.(null);
      try { player.current?.destroy(); } catch { /* already gone */ }
      player.current = null;
    };
    // A new video makes a new player; the start only matters when it's made
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return <div className="lu-yt" ref={host} title={title} />;
}
