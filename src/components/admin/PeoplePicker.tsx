import { Link } from 'react-router-dom';
import type { Person } from '../../types';
import type { AdminLocale, AdminStrings } from '../../i18n/admin';

export function personName(p: Person, locale: AdminLocale): string {
  const ja = [p.name_family_ja, p.name_given_ja].filter(Boolean).join(' ');
  const en = [p.name_given_en, p.name_family_en].filter(Boolean).join(' ');
  return (locale === 'ja' ? ja || en : en || ja) || p.id;
}

/**
 * Chips for the chosen people plus a dropdown to add another.
 * Stored as comma-separated person IDs, as in the existing sheet.
 */
export default function PeoplePicker({ s, locale, id, value, onChange, people, personHref }: {
  s: AdminStrings;
  locale: AdminLocale;
  id: string;
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  /** Link each chosen person to their page. */
  personHref?: (personId: string) => string;
}) {
  const chosen = value.split(',').map(x => x.trim()).filter(Boolean);
  const byId = new Map(people.map(p => [p.id, p]));
  const available = people
    .filter(p => !chosen.includes(p.id))
    .sort((a, b) => personName(a, locale).localeCompare(personName(b, locale)));

  return (
    <div className="lu-people">
      {chosen.map(pid => (
        <span key={pid} className="lu-chip">
          {byId.get(pid) && personHref
            ? <Link to={personHref(pid)}>{personName(byId.get(pid)!, locale)}</Link>
            : byId.get(pid) ? personName(byId.get(pid)!, locale) : pid}
          <button type="button" aria-label={s.remove} onClick={() => onChange(chosen.filter(x => x !== pid).join(','))}>✕</button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          id={id}
          value=""
          onChange={e => { if (e.target.value) onChange([...chosen, e.target.value].join(',')); }}
        >
          <option value="">{s.pickPerson}</option>
          {available.map(p => <option key={p.id} value={p.id}>{personName(p, locale)}</option>)}
        </select>
      )}
    </div>
  );
}
