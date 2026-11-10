import { useState } from 'react';
import { Link } from 'react-router-dom';
import SuggestInput from './SuggestInput';
import type { Person } from '../../types';
import type { AdminLocale, AdminStrings } from '../../i18n/admin';

export function personName(p: Person, locale: AdminLocale): string {
  const ja = [p.name_family_ja, p.name_given_ja].filter(Boolean).join(' ');
  const en = [p.name_given_en, p.name_family_en].filter(Boolean).join(' ');
  return (locale === 'ja' ? ja || en : en || ja) || p.id;
}

/**
 * One box: the chosen people as chips, then type to add another (↑↓ and
 * Enter, or click). Backspace in the empty box removes the last one.
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
  const [text, setText] = useState('');
  const chosen = value.split(',').map(x => x.trim()).filter(Boolean);
  const byId = new Map(people.map(p => [p.id, p]));
  const available = people
    .filter(p => !chosen.includes(p.id))
    .sort((a, b) => personName(a, locale).localeCompare(personName(b, locale)));
  const other = (p: Person) => personName(p, locale === 'ja' ? 'en' : 'ja');
  const suggestions = available.map(p => ({ value: personName(p, locale), hint: other(p) !== personName(p, locale) ? other(p) : undefined, keywords: p.id }));

  const add = (typed: string) => {
    const p = available.find(x => personName(x, locale) === typed || other(x) === typed);
    if (p) { onChange([...chosen, p.id].join(',')); setText(''); } else setText(typed);
  };

  return (
    <div className="lu-people lu-people-box" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      {chosen.map(pid => (
        <span key={pid} className="lu-chip">
          {byId.get(pid) && personHref
            ? <Link to={personHref(pid)} onClick={e => e.stopPropagation()}>{personName(byId.get(pid)!, locale)}</Link>
            : byId.get(pid) ? personName(byId.get(pid)!, locale) : pid}
          <button type="button" aria-label={`${s.remove}: ${byId.get(pid) ? personName(byId.get(pid)!, locale) : pid}`} onClick={e => { e.stopPropagation(); onChange(chosen.filter(x => x !== pid).join(',')); }}>✕</button>
        </span>
      ))}
      {available.length > 0 && (
        <SuggestInput
          id={id}
          wrapClassName="lu-people-input"
          value={text}
          placeholder={chosen.length ? '' : s.pickPerson}
          suggestions={suggestions}
          onChange={add}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !text && chosen.length) { e.preventDefault(); onChange(chosen.slice(0, -1).join(',')); }
          }}
        />
      )}
    </div>
  );
}
