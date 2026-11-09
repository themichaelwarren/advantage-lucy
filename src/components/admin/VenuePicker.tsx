import { useMemo, useRef, useState } from 'react';
import type { Area, Venue } from '../../types';
import type { AdminLocale, AdminStrings } from '../../i18n/admin';
import { createRow } from '../../services/adminService';
import { errorText, makeId } from './ui';
import SuggestInput, { Highlight, rankMatches } from './SuggestInput';
import type { Suggestion } from './SuggestInput';

/** Areas as suggestions: name in the admin's language, the other one greyed. */
export function areaSuggestions(areas: Area[], locale: AdminLocale): Suggestion[] {
  return areas
    .map(a => {
      const main = (locale === 'ja' ? a.name_ja || a.name_en : a.name_en || a.name_ja) || a.id;
      const other = locale === 'ja' ? a.name_en : a.name_ja;
      return { value: main, hint: other && other !== main ? other : undefined, keywords: a.id };
    })
    .sort((x, y) => x.value.localeCompare(y.value, locale));
}

/**
 * Find the area whose name (either language) or ID matches what was typed,
 * or create it. Returns undefined for an empty string.
 */
export async function resolveArea(typed: string, areas: Area[]): Promise<Area | undefined> {
  const t = typed.trim();
  if (!t) return undefined;
  const found = areas.find(a => [a.name_en, a.name_ja, a.id].some(n => n && n.toLowerCase() === t.toLowerCase()));
  if (found) return found;
  const ascii = /^[\x20-\x7e]+$/.test(t);
  const area: Area = {
    id: makeId([ascii ? t : `area-${Date.now().toString(36)}`], new Set(areas.map(a => a.id))),
    name_en: ascii ? t : '',
    name_ja: ascii ? '' : t,
    prefecture: '',
  };
  await createRow('Areas', { ...area });
  return area;
}

/**
 * Search-as-you-type venue chooser. "Add a new venue" asks only for the
 * names and the area: IDs are made automatically, and a new area is created
 * on the fly if the typed one doesn't exist yet.
 */
export default function VenuePicker({ s, locale, id, value, onChange, venues, areas, onCreated, onError }: {
  s: AdminStrings;
  locale: AdminLocale;
  id: string;
  value: string;
  onChange: (venueId: string) => void;
  venues: Venue[];
  areas: Area[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const areaById = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
  const current = venues.find(v => v.id === value);
  const nameOf = (v: Venue) => (locale === 'ja' ? v.name_ja || v.name_en : v.name_en || v.name_ja);
  const areaOf = (v: Venue) => {
    const a = areaById.get(v.area);
    return a ? (locale === 'ja' ? a.name_ja || a.name_en : a.name_en || a.name_ja) : v.area;
  };

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name_en: '', name_ja: '', area: '' });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => rankMatches(venues, query, v => [v.name_en, v.name_ja, areaOf(v), v.id]).slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, venues, areaById, locale],
  );
  const areaList = useMemo(() => areaSuggestions(areas, locale), [areas, locale]);

  function choose(v: Venue) {
    onChange(v.id);
    setQuery('');
    setOpen(false);
  }

  async function createVenue() {
    if (!draft.name_en.trim() && !draft.name_ja.trim()) return;
    setBusy(true);
    try {
      const area = await resolveArea(draft.area, areas);
      const venueId = makeId([draft.name_en || draft.name_ja], new Set(venues.map(v => v.id)));
      await createRow('Venues', { id: venueId, name_en: draft.name_en.trim(), name_ja: draft.name_ja.trim(), area: area?.id || '' });
      onChange(venueId);
      onCreated();
      setCreating(false);
      setDraft({ name_en: '', name_ja: '', area: '' });
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <div className="lu-inline-card">
        <div className="lu-bilingual">
          <input placeholder={s.venueNewName} value={draft.name_en} onChange={e => setDraft(d => ({ ...d, name_en: e.target.value }))} autoFocus />
          <input placeholder={s.venueNewNameJa} value={draft.name_ja} onChange={e => setDraft(d => ({ ...d, name_ja: e.target.value }))} lang="ja" />
        </div>
        <SuggestInput
          placeholder={s.venueNewArea}
          aria-label={s.venueNewArea}
          value={draft.area}
          onChange={v => setDraft(d => ({ ...d, area: v }))}
          suggestions={areaList}
          newLabel={s.newArea}
        />
        <div className="lu-row">
          <button type="button" className="lu-btn" onClick={() => setCreating(false)}>{s.cancel}</button>
          <button type="button" className="lu-btn lu-btn-primary" disabled={busy || (!draft.name_en.trim() && !draft.name_ja.trim())} onClick={createVenue}>
            {busy ? s.saving : s.venueCreate}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lu-combobox">
      {current && !open ? (
        <button type="button" id={id} className="lu-chosen" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
          <strong>{nameOf(current)}</strong>
          <span>{areaOf(current)}</span>
          <span className="lu-chosen-change">{s.edit}</span>
        </button>
      ) : (
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={s.venuePick}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]); }
            if (e.key === 'Escape') setOpen(false);
          }}
        />
      )}
      {open && (
        <ul className="lu-options" role="listbox">
          {matches.map((v, i) => (
            <li
              key={v.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={e => { e.preventDefault(); choose(v); }}
              onMouseEnter={() => setActive(i)}
            >
              <strong><Highlight text={nameOf(v)} query={query} /></strong> <span><Highlight text={areaOf(v)} query={query} /></span>
            </li>
          ))}
          <li
            className="lu-option-new"
            onMouseDown={e => {
              e.preventDefault();
              setDraft(d => ({ ...d, [/^[\x20-\x7e]*$/.test(query) ? 'name_en' : 'name_ja']: query }));
              setCreating(true);
              setOpen(false);
            }}
          >
            + {s.venueNew}{query && <> “{query}”</>}
          </li>
        </ul>
      )}
    </div>
  );
}
