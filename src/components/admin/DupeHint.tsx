import { useMemo } from 'react';
import type { AdminStrings, AdminLocale } from '../../i18n/admin';
import type { Area, Event, Venue } from '../../types';
import { similarVenues, sameDayShows } from '../../utils/duplicates';
import { getEventTitle } from '../../utils/format';
import Icon from './Icon';

/**
 * "Is this already in the archive?" while you add a venue or a show. Only
 * a hint: links open in a new tab so nothing typed is lost, and saving
 * anyway still works (after a confirm). See utils/duplicates.ts.
 */

const pick = (locale: AdminLocale, en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';

export function useVenueMatches(name: { name_en?: string; name_ja?: string }, venues: Venue[], exceptId?: string) {
  const key = `${name.name_en || ''}|${name.name_ja || ''}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => similarVenues(name, venues, exceptId), [key, venues, exceptId]);
}

export function VenueDupeHint({ s, locale, prefix, matches, areas, onUse }: {
  s: AdminStrings; locale: AdminLocale; prefix: string;
  matches: { venue: Venue; strong: boolean }[]; areas: Area[];
  /** In the show form's venue picker: pick the existing venue instead */
  onUse?: (v: Venue) => void;
}) {
  if (!matches.length) return null;
  const areaName = (id?: string) => { const a = areas.find(x => x.id === id); return a ? pick(locale, a.name_en, a.name_ja) : ''; };
  const strong = matches.some(m => m.strong);
  return (
    <div className={`lu-dupe${strong ? ' is-strong' : ''}`} role="status">
      <p className="lu-dupe-head"><Icon name="warn" /> <strong>{s.dupVenueTitle}</strong> {strong ? s.dupVenueStrong : s.dupVenueSoft}</p>
      <ul>
        {matches.map(({ venue: v }) => (
          <li key={v.id}>
            <span className="lu-dupe-name">
              <strong>{pick(locale, v.name_en, v.name_ja)}</strong>
              {pick(locale, v.name_ja, v.name_en) !== pick(locale, v.name_en, v.name_ja) && <span lang={locale === 'ja' ? 'en' : 'ja'}>{pick(locale, v.name_ja, v.name_en)}</span>}
              {v.area && <small>{areaName(v.area)}</small>}
            </span>
            <span className="lu-row">
              {onUse && <button type="button" className="lu-btn lu-btn-sm" onClick={() => onUse(v)}>{s.dupUse}</button>}
              <a className="lu-btn lu-btn-sm lu-btn-quiet" href={`${prefix}/venues/${v.id}`} target="_blank" rel="noopener">{s.dupOpen} <Icon name="external" /></a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShowDupeHint({ s, locale, prefix, date, venue, events, exceptId }: {
  s: AdminStrings; locale: AdminLocale; prefix: string;
  date: string; venue?: string; events: Event[]; exceptId?: string;
}) {
  const same = useMemo(() => sameDayShows({ date, venue_id: venue }, events, exceptId), [date, venue, events, exceptId]);
  if (!same.length) return null;
  const strong = same.some(x => x.sameVenue);
  return (
    <div className={`lu-dupe${strong ? ' is-strong' : ' is-soft'}`} role="status">
      <p className="lu-dupe-head">{strong && <Icon name="warn" />} {strong ? <strong>{s.dupShowStrong}</strong> : s.dupShowSoft}</p>
      <ul>
        {same.map(({ event: e, sameVenue }) => (
          <li key={e.id} className={sameVenue ? 'is-same' : ''}>
            <span className="lu-dupe-name">
              <strong>{getEventTitle(e, locale)}</strong>
              <small>{pick(locale, e.venue_en, e.venue_ja)}</small>
            </span>
            <a className="lu-btn lu-btn-sm lu-btn-quiet" href={`${prefix}/events/${e.id}`} target="_blank" rel="noopener">{s.dupOpen} <Icon name="external" /></a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Will saving add a second show on the same day at the same venue? */
export const isDoubleShow = (date: string, venue: string | undefined, events: Event[], exceptId?: string) =>
  sameDayShows({ date, venue_id: venue }, events, exceptId).some(x => x.sameVenue);
