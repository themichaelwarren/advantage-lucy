import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAllEvents, useAllSongs, useAllAlbums, useVenues, usePeople, useAreas, useAllNews, useAllBlog,
} from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import type { AdminLocale } from '../../i18n/admin';
import { personName } from './PeoplePicker';
import { Highlight, rankMatches } from './SuggestInput';
import { songTitle, songAltTitle } from '../../utils/songTitles';

interface Item {
  kind: string;        // group label
  title: string;
  sub?: string;
  href: string;
  keywords?: string;   // extra text to match (other language, IDs…)
}

const pick = (locale: AdminLocale, en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';

/**
 * ⌘K / Ctrl+K search across the whole admin: shows, songs, releases,
 * venues, people, areas, news and blog, plus quick "New …" actions.
 * Results are real links, so the unsaved-changes prompt still applies.
 */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const { s, locale, prefix } = useAdminT();
  const { events } = useAllEvents();
  const { songs } = useAllSongs();
  const { albums } = useAllAlbums();
  const { venues } = useVenues();
  const { people } = usePeople();
  const { areas } = useAreas();
  const { news } = useAllNews();
  const { blog } = useAllBlog();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const venueName = new Map(venues.map(v => [v.id, pick(locale, v.name_en, v.name_ja)]));
    const actions: Item[] = [
      { kind: s.actions, title: `+ ${s.newShow}`, href: `${prefix}/events/new` },
      { kind: s.actions, title: `+ ${s.newNews}`, href: `${prefix}/news/new` },
      { kind: s.actions, title: `+ ${s.newBlog}`, href: `${prefix}/blog/new` },
      { kind: s.actions, title: `+ ${s.newRelease}`, href: `${prefix}/releases/new` },
      { kind: s.actions, title: `+ ${s.newSongItem}`, href: `${prefix}/songs/new` },
      { kind: s.actions, title: `+ ${s.newVenue}`, href: `${prefix}/venues/new` },
    ];
    const shows: Item[] = [...events].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
      const title = pick(locale, e.title_en, e.title_ja);
      const venue = pick(locale, e.venue_en, e.venue_ja) || venueName.get(e.venue_id || '') || '';
      return {
        kind: s.shows, title: title || venue || e.id, sub: [e.date, title ? venue : ''].filter(Boolean).join(' · '),
        href: `${prefix}/events/${e.id}`, keywords: `${e.date} ${e.title_en} ${e.title_ja} ${e.venue_en} ${e.venue_ja} ${e.id}`,
      };
    });
    return [
      ...actions,
      ...shows,
      // Found by either title or the reading (Onboru, おんぼろ); the other language shows underneath
      ...songs.filter(x => x.id).map(x => ({
        kind: s.songs, title: songTitle(x, locale), sub: [songAltTitle(x, locale), x.original_artist].filter(Boolean).join(' · '),
        href: `${prefix}/songs/${x.id}`, keywords: `${x.title} ${x.title_en || ''} ${x.title_kana || ''} ${x.id} ${x.original_artist || ''}`,
      })),
      ...albums.map(a => ({ kind: s.releases, title: songTitle(a, locale), sub: [songAltTitle(a, locale), a.date || a.year, a.label].filter(Boolean).join(' · '), href: `${prefix}/releases/${a.id}`, keywords: `${a.title} ${a.title_en || ''} ${a.title_kana || ''} ${a.year} ${a.label || ''} ${a.number || ''}` })),
      ...venues.map(v => ({ kind: s.venues, title: pick(locale, v.name_en, v.name_ja) || v.id, href: `${prefix}/venues/${v.id}`, keywords: `${v.name_en} ${v.name_ja} ${v.id}` })),
      ...people.map(p => ({ kind: s.people, title: personName(p, locale), href: `${prefix}/people/${p.id}`, keywords: `${personName(p, locale === 'ja' ? 'en' : 'ja')} ${p.id}` })),
      ...areas.map(a => ({ kind: s.areas, title: pick(locale, a.name_en, a.name_ja) || a.id, href: `${prefix}/areas/${a.id}`, keywords: `${a.name_en} ${a.name_ja} ${a.id}` })),
      ...[...news].sort((a, b) => b.date.localeCompare(a.date)).map(n => ({ kind: s.news, title: pick(locale, n.title_en, n.title_ja) || n.id, sub: n.date, href: `${prefix}/news/${n.id}`, keywords: `${n.title_en} ${n.title_ja} ${n.date}` })),
      ...[...blog].sort((a, b) => b.date.localeCompare(a.date)).map(b => ({ kind: s.blog, title: pick(locale, b.title_en, b.title_ja) || b.instagram_url || b.id, sub: b.date, href: `${prefix}/blog/${b.id}`, keywords: `${b.title_en} ${b.title_ja} ${b.date}` })),
    ];
  }, [events, songs, albums, venues, people, areas, news, blog, locale, prefix, s]);

  // With nothing typed: the quick actions. Typing: best matches, max 8 per kind
  const results = useMemo(() => {
    if (!query.trim()) return items.filter(i => i.kind === s.actions);
    const ranked = rankMatches(items, query, i => [i.title, i.sub, i.keywords]);
    const perKind = new Map<string, number>();
    return ranked.filter(i => {
      const n = (perKind.get(i.kind) || 0) + 1;
      perKind.set(i.kind, n);
      return n <= 8;
    }).slice(0, 40);
  }, [items, query, s.actions]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Group in order of first appearance, keeping the overall index for ↑/↓
  const groups: { kind: string; rows: { item: Item; index: number }[] }[] = [];
  results.forEach((item, index) => {
    let g = groups.find(x => x.kind === item.kind);
    if (!g) { g = { kind: item.kind, rows: [] }; groups.push(g); }
    g.rows.push({ item, index });
  });

  return (
    <div className="lu-modal-overlay lu-palette-overlay" onMouseDown={onClose}>
      <div className="lu-palette" role="dialog" aria-modal="true" aria-label={s.searchEverything} onMouseDown={e => e.stopPropagation()}>
        <input
          className="lu-palette-input"
          autoFocus
          placeholder={s.searchEverything}
          aria-label={s.searchEverything}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter') {
              e.preventDefault();
              // Click the real link, so the unsaved-changes prompt sees it
              listRef.current?.querySelector<HTMLAnchorElement>('[aria-selected="true"]')?.click();
            } else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          }}
        />
        <div className="lu-palette-results" ref={listRef} role="listbox">
          {results.length === 0 && <p className="lu-palette-empty">{s.noResults}</p>}
          {groups.map(g => (
            <div key={g.kind} className="lu-palette-group">
              <p className="lu-palette-kind">{g.kind}</p>
              {g.rows.map(({ item, index }) => (
                <Link
                  key={`${item.href}|${index}`}
                  to={item.href}
                  role="option"
                  aria-selected={index === active}
                  className={`lu-palette-row${index === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={onClose}
                >
                  <strong><Highlight text={item.title} query={query} /></strong>
                  {item.sub && <span><Highlight text={item.sub} query={query} /></span>}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <p className="lu-palette-foot"><kbd>↑</kbd><kbd>↓</kbd> {s.paletteMove} · <kbd>↵</kbd> {s.paletteOpen} · <kbd>esc</kbd> {s.close}</p>
      </div>
    </div>
  );
}
