import { useState } from 'react';
import Icon from './Icon';

/**
 * A faint ↓ on a video: copies a yt-dlp command that saves it as
 * "~/Movies/advantage Lucy/<date> <venue> – <title>.mp4", for pasting
 * into Terminal. (The site can't download it itself: it runs on
 * Cloudflare, and YouTube blocks data-centre downloads.)
 */
const DIR = '$HOME/Movies/advantage Lucy';

/** Safe in a filename and inside "double quotes" in the shell */
const clean = (t: string) => t.replace(/[/\\:*?"<>|$`!]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

export function downloadCommand(url: string, parts: (string | undefined)[]): string {
  const name = clean(parts.filter(Boolean).join(' ')) || 'video';
  return `yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o "${DIR}/${name}.%(ext)s" "${url.trim().replace(/"/g, '')}"`;
}

export default function CopyDownload({ url, parts, label }: { url: string; parts: (string | undefined)[]; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={`lu-copy-dl${done ? ' is-done' : ''}`} title={label} aria-label={label}
      onClick={async e => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(downloadCommand(url, parts)); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
      }}>
      <Icon name={done ? 'check' : 'download'} />
    </button>
  );
}
