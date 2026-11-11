import { useEffect, useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';

export interface Option { value: string; label: React.ReactNode }

/**
 * Per-page list settings (search, filter, sort, view), remembered in the
 * browser so each admin page opens the way you left it. Search isn't
 * remembered: a stale search hiding rows would be confusing.
 */
export function useListPrefs<F extends string, S extends string, V extends string = 'list'>(
  page: string,
  defaults: { filter: F; sort: S; view?: V },
) {
  const key = `admin-list-${page}`;
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      // A link can pick the filter: /admin/events?filter=nosetlist
      const fromLink = new URLSearchParams(location.search).get('filter');
      return { ...defaults, ...saved, ...(fromLink ? { filter: fromLink } : {}) } as { filter: F; sort: S; view?: V };
    } catch { return defaults; }
  });
  const [query, setQuery] = useState('');
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* ignore */ } }, [key, prefs]);
  return {
    query, setQuery,
    filter: prefs.filter, setFilter: (filter: F) => setPrefs(p => ({ ...p, filter })),
    sort: prefs.sort, setSort: (sort: S) => setPrefs(p => ({ ...p, sort })),
    view: prefs.view, setView: (view: V) => setPrefs(p => ({ ...p, view })),
  };
}

/** Search, filter chips, sort and (optionally) a view switch: the same on every admin list. */
export default function ListToolbar({ s, query, onQuery, filters, filter, onFilter, sorts, sort, onSort, views, view, onView, shown, total }: {
  s: AdminStrings;
  query: string;
  onQuery: (q: string) => void;
  filters?: Option[];
  filter?: string;
  onFilter?: (v: string) => void;
  sorts?: Option[];
  sort?: string;
  onSort?: (v: string) => void;
  views?: Option[];
  view?: string;
  onView?: (v: string) => void;
  shown?: number;
  total?: number;
}) {
  return (
    <div className="lu-toolbar">
      <input type="search" className="lu-search" placeholder={s.search} value={query} onChange={e => onQuery(e.target.value)} aria-label={s.search} />
      <div className="lu-toolbar-row">
        {filters && filters.length > 0 && (
          <div className="lu-chips" role="group" aria-label={s.filterAll}>
            {filters.map(f => (
              <button key={f.value} type="button" className={`lu-pill${filter === f.value ? ' is-on' : ''}`} aria-pressed={filter === f.value} onClick={() => onFilter?.(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="lu-toolbar-right">
          {shown != null && total != null && shown !== total && (
            <span className="lu-hint lu-toolbar-count">{s.showingCount} {shown} / {total}</span>
          )}
          {sorts && sorts.length > 1 && (
            <label className="lu-sort">
              <span className="lu-visually-hidden">{s.sortBy}</span>
              <select value={sort} onChange={e => onSort?.(e.target.value)} aria-label={s.sortBy}>
                {sorts.map(o => <option key={o.value} value={o.value}>↕ {o.label}</option>)}
              </select>
            </label>
          )}
          {views && views.length > 1 && (
            <div className="lu-chips" role="group">
              {views.map(v => (
                <button key={v.value} type="button" className={`lu-pill${view === v.value ? ' is-on' : ''}`} aria-pressed={view === v.value} onClick={() => onView?.(v.value)}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** An on/off switch for a table cell. */
export function SwitchCell({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="lu-switch" onClick={onChange}>
      <span className="lu-switch-knob" />
    </button>
  );
}

/** Last column of a quick-edit table: save status, or the Edit link. */
export function SaveStateCell({ s, state, editHref, renderLink }: {
  s: AdminStrings;
  state?: string;
  editHref: string;
  renderLink: (href: string, label: string) => React.ReactNode;
}) {
  return (
    <td className="lu-td-actions">
      {state === 'saving' ? <span className="lu-hint">{s.saving}</span>
        : state === 'saved' ? <span className="lu-status-ok">✓ {s.savedShort}</span>
        : state ? <span className="lu-status-error" title={state}>! {s.errorPrefix}</span>
        : renderLink(editHref, s.edit)}
    </td>
  );
}
