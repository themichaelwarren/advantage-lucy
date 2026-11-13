import { useLinks } from '../hooks/useSheetData';

/**
 * "Links" on a show, song or release page: blog posts, setlist pages and
 * the like that the band has collected (only the public ones reach here).
 */
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

export default function RelatedLinks({ owner, title, className = 'evd-section' }: { owner: string; title: string; className?: string }) {
  const links = useLinks(owner);
  if (!links.length) return null;
  return (
    <section className={`${className} related-links`}>
      <h2 className="section-label">{title}</h2>
      <ul>
        {links.map((l, i) => (
          <li key={i}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title || host(l.url)} <span aria-hidden="true">↗</span></a>
            <span className="related-links-host">{host(l.url)}</span>
            {l.note && <p>{l.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
