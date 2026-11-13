import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { getActivity, type ActivityEntry, type ActivityChange } from '../../services/adminService';
import { Section } from './ui';

/**
 * The activity log, read: who changed what, when. Saves of the same thing
 * by the same person within a few minutes read as one (a show saved with
 * its setlist and videos is one save, not three lines).
 *
 *   <ActivityHistory refs={['Events:abc', 'Setlists:abc']} />  a detail page's 履歴
 *   groupActivity(entries) + <ActivityGroupView />             the 最近の変更 page
 */

/** The thing an entry is about: a show's setlist and videos are the show's. */
export function thingOf(e: Pick<ActivityEntry, 'tab' | 'item'>, albumIdByTitle?: Map<string, string>): string {
  if (e.tab === 'Setlists') return `Events:${e.item}`;
  if (e.tab === 'Tracklists') return `Albums:${albumIdByTitle?.get(e.item) ?? e.item}`;
  return `${e.tab}:${e.item}`;
}

export interface ActivityGroup { key: string; who: string; at: string; thing: string; entries: ActivityEntry[] }

const SAME_SAVE_MS = 5 * 60 * 1000;

/** Newest first in, newest first out. */
export function groupActivity(entries: ActivityEntry[], albumIdByTitle?: Map<string, string>): ActivityGroup[] {
  const out: ActivityGroup[] = [];
  for (const e of entries) {
    const thing = thingOf(e, albumIdByTitle);
    const last = out[out.length - 1];
    const oldest = last?.entries[last.entries.length - 1];
    if (last && last.who === e.who && last.thing === thing && Date.parse(oldest.at) - Date.parse(e.at) < SAME_SAVE_MS) {
      last.entries.push(e);
    } else {
      out.push({ key: `${e.at}|${e.who}|${thing}`, who: e.who, at: e.at, thing, entries: [e] });
    }
  }
  return out;
}

/** "michael@queenand.co" → "Michael" */
export const whoName = (email: string) => {
  const local = (email || '?').split('@')[0].split(/[._+-]/)[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
};

const tokyo = (iso: string) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso));
  const g = (t: string) => p.find(x => x.type === t)?.value || '';
  return { day: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
};
/** The day (in Japan) an entry was made: "2026-11-11" */
export const dayOf = (iso: string) => tokyo(iso).day;

/** "just now", "12 min ago", "14:05" (today), "2026.11.09 14:05" */
export function whenText(iso: string, s: AdminStrings, locale: string, now = Date.now()): string {
  const ms = now - Date.parse(iso);
  if (ms < 60_000) return s.actJustNow;
  if (ms < 3_600_000) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-Math.round(ms / 60_000), 'minute');
  const t = tokyo(iso);
  return t.day === tokyo(new Date(now).toISOString()).day ? t.time : `${t.day.replace(/-/g, '.')} ${t.time}`;
}

function headline(e: ActivityEntry, s: AdminStrings): string {
  switch (e.action) {
    case 'create': return s.actCreate;
    case 'update': return s.actUpdate;
    case 'delete': return s.actDelete;
    case 'reorder': return s.actReorder;
    case 'replace': return e.tab === 'Tracklists' ? s.actTracks : s.actSetlist;
    case 'videos': return s.actVideos;
    case 'arrangements': return s.actArrangements;
    case 'filters': return s.actFilters;
    case 'links': return s.actLinks;
    case 'rename': return s.actRename;
    case 'notes': return s.actNotes;
    default: return s.actChanged;
  }
}

/** A value as people read it: on/off for switches, the text otherwise. */
function shown(f: string, v: string | undefined, s: AdminStrings): string | undefined {
  if (v === undefined) return undefined;
  if (f.endsWith('status')) return v === 'private' ? s.songDraft : s.visPageShort;
  if (f === 'featured' || f === 'share_image') return v === 'true' || v === 'yes' ? '✓' : '—';
  return v;
}

function ChangeLine({ c, s }: { c: ActivityChange; s: AdminStrings }) {
  if (c.f === '+') return <li className="lu-act-add"><span aria-hidden="true">+</span> {c.to}</li>;
  if (c.f === '-') return <li className="lu-act-del"><span aria-hidden="true">−</span> <s>{c.from}</s></li>;
  if (c.f === 'order') return c.to ? null : <li className="lu-act-note">{s.actOrder}</li>;
  if (c.f === 'details') return <li className="lu-act-note">{s.actDetails}</li>;
  if (c.f === 'more') return <li className="lu-act-note">{s.actMoreChanges.replace('{n}', c.to || '')}</li>;
  const label = s.actFields[c.f] || c.f;
  const statusLike = c.f.endsWith('status') || c.f === 'featured' || c.f === 'share_image';
  const from = shown(c.f, c.from ?? (statusLike ? '' : undefined), s);
  const to = shown(c.f, c.to ?? (statusLike ? '' : undefined), s);
  if (from === undefined && to === undefined) return <li><span className="lu-act-field">{label}</span> <span className="lu-act-note">{s.actChanged}</span></li>;
  return (
    <li>
      <span className="lu-act-field">{label}</span>{' '}
      {from !== undefined && <><del className="lu-act-from">{from}</del>{' '}</>}
      <span className="lu-act-arrow" aria-hidden="true">→</span>{' '}
      {to !== undefined ? <ins className="lu-act-to">{to}</ins> : <span className="lu-act-note">{s.actCleared}</span>}
    </li>
  );
}

/** One save: who and when, then what each part of it changed. */
export function ActivityGroupView({ g, s, locale, title }: { g: ActivityGroup; s: AdminStrings; locale: string; title?: ReactNode }) {
  const many = g.entries.length > 1;
  return (
    <li className="lu-act">
      <div className="lu-act-head">
        <span className="lu-act-who" aria-hidden="true">{whoName(g.who).charAt(0)}</span>
        <span className="lu-act-meta">
          {title}
          <span className="lu-act-by"><strong title={g.who}>{whoName(g.who)}</strong> · <time dateTime={g.at} title={new Date(g.at).toLocaleString(locale, { timeZone: 'Asia/Tokyo' })}>{whenText(g.at, s, locale)}</time></span>
        </span>
      </div>
      <div className="lu-act-body">
        {/* Oldest part first: "edited" then "setlist" reads as it happened */}
        {[...g.entries].reverse().map((e, i) => {
          const lines = e.changes.filter(c => !(c.f === 'order' && c.to));
          const tag = <span className={`lu-act-what is-${e.action}`}>{headline(e, s)}</span>;
          if (!lines.length) return <p key={i} className="lu-act-part">{tag}</p>;
          return (
            <div key={i} className="lu-act-part">
              {(many || e.action !== 'update') && tag}
              <ul className="lu-act-lines">{lines.map((c, j) => <ChangeLine key={j} c={c} s={s} />)}</ul>
            </div>
          );
        })}
      </div>
    </li>
  );
}

// After any admin save, open histories look again (the log is written just after the save answers)
const SAVED_EVENT = 'lu-admin-saved';

/** Load the log (for these items, or all of it), and again after each save. */
export function useActivity(refs: string[], limit = 300) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState(false);
  const key = refs.join(',');
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => getActivity(key ? key.split(',') : [], limit)
      .then(r => { if (live) { setEntries(r); setError(false); } })
      .catch(() => { if (live) setError(true); });
    load();
    const again = () => { clearTimeout(timer); timer = setTimeout(load, 2500); };
    window.addEventListener(SAVED_EVENT, again);
    return () => { live = false; clearTimeout(timer); window.removeEventListener(SAVED_EVENT, again); };
  }, [key, limit]);
  return { entries, error };
}

const SHOWN = 5;

/** A detail page's 履歴: the latest few saves, the rest a click away. */
export function ActivityHistory({ s, locale, refs }: { s: AdminStrings; locale: string; refs: string[] }) {
  const { entries } = useActivity(refs.filter(r => !r.endsWith(':')), 200);
  const [all, setAll] = useState(false);
  const groups = useMemo(() => groupActivity(entries || []), [entries]);
  if (entries === null) return null;
  const list = all ? groups : groups.slice(0, SHOWN);
  return (
    <Section title={groups.length ? `${s.actHistory} · ${groups.length}` : s.actHistory}>
      {groups.length === 0 ? <p className="lu-hint">{s.actNoneItem}</p> : (
        <>
          <ol className="lu-acts">{list.map(g => <ActivityGroupView key={g.key} g={g} s={s} locale={locale} />)}</ol>
          {groups.length > SHOWN && (
            <button type="button" className="lu-link-btn lu-act-toggle" onClick={() => setAll(a => !a)}>
              {all ? s.lyricsLess : s.actShowAll.replace('{n}', String(groups.length))}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/** The link to a thing in the admin, with its kind. */
export function thingLink(thing: string, prefix: string): string | null {
  const [tab, ...rest] = thing.split(':');
  const id = rest.join(':');
  if (!id) return null;
  const path: Record<string, string> = {
    Events: 'events', Songs: 'songs', Albums: 'releases', Venues: 'venues', People: 'people', Areas: 'areas',
    News: 'news', Blog: 'blog', Photos: 'photos', Prefectures: 'prefectures', Countries: 'countries',
  };
  return path[tab] ? `${prefix}/${path[tab]}/${encodeURIComponent(id)}` : null;
}

