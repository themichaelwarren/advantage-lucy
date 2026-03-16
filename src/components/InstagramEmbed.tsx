import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let scriptLoading = false;

function ensureScript() {
  if (window.instgrm || scriptLoading) return;
  scriptLoading = true;
  const s = document.createElement('script');
  s.src = '//www.instagram.com/embed.js';
  s.async = true;
  document.body.appendChild(s);
}

interface Props {
  url: string;
}

export default function InstagramEmbed({ url }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureScript();
    // Process embeds once the script is ready
    const id = setInterval(() => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [url]);

  return (
    <div ref={ref} className="instagram-embed">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          margin: '0 auto',
          maxWidth: '540px',
          minWidth: '326px',
          padding: 0,
          width: '100%',
        }}
      />
    </div>
  );
}
