import { useState } from 'react';
import type { AdminLocale, AdminStrings } from '../../i18n/admin';
import { saveFilterEmails, saveFilterForward, type Filters } from '../../services/adminService';
import { setFilters } from '../../hooks/useFilters';
import { errorText, ConfirmDialog, InfoHint, Section } from './ui';

/**
 * The filtered senders: their addresses (with misspellings, one per row)
 * and where their messages are emailed instead of the band's inbox.
 */
export default function FilterManager({ s, locale, filters }: { s: AdminStrings; locale: AdminLocale; filters: Filters }) {
  const emails = filters.rows.filter(r => r.kind === 'email');
  const [adding, setAdding] = useState({ value: '', note: '' });
  const [forward, setForward] = useState(filters.forwardTo);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  async function run(what: string, task: () => Promise<Filters>) {
    setBusy(what); setError('');
    try { setFilters(await task()); return true; }
    catch (err) { setError(errorText(err)); return false; }
    finally { setBusy(''); }
  }
  const add = async () => {
    const value = adding.value.trim();
    if (!value) return;
    if (await run('add', () => saveFilterEmails([...emails, { value, note: adding.note.trim() }]))) setAdding({ value: '', note: '' });
  };
  const when = (d: string) => (d ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { dateStyle: 'medium' }).format(new Date(`${d}T00:00:00`)) : '');

  return (
    <Section title={`${s.filterListTitle} · ${emails.length}`} badge={<InfoHint text={s.filterHowTip} />}>
      <div className="lu-filters">
      <ConfirmDialog
        s={s} open={removing !== null}
        title={s.filterRemoveTitle} body={s.filterRemoveBody.replace('{email}', removing || '')} confirmLabel={s.filterRemoveYes}
        onCancel={() => setRemoving(null)}
        onConfirm={() => { const v = removing; setRemoving(null); run('remove', () => saveFilterEmails(emails.filter(r => r.value !== v))); }}
      />
      <p className="lu-hint">🔒 {s.filterIntro}</p>

      {emails.length > 0 && (
        <ul className="lu-filter-list">
          {emails.map(r => (
            <li key={r.value}>
              <span className="lu-filter-addr">{r.value}</span>
              {r.note && <span className="lu-filter-note">{r.note}</span>}
              {r.added && <time className="lu-filter-added">{when(r.added)}</time>}
              <button type="button" className="lu-icon-btn is-danger" aria-label={`${s.remove}: ${r.value}`} title={s.remove}
                disabled={!!busy} onClick={() => setRemoving(r.value)}>✕</button>
            </li>
          ))}
        </ul>
      )}

      <form className="lu-filter-add" onSubmit={e => { e.preventDefault(); add(); }}>
        <input type="email" inputMode="email" autoComplete="off" placeholder={s.filterAddPlaceholder} aria-label={s.filterAddPlaceholder}
          value={adding.value} onChange={e => setAdding(a => ({ ...a, value: e.target.value }))} />
        <input placeholder={s.filterNotePlaceholder} aria-label={s.filterNotePlaceholder}
          value={adding.note} onChange={e => setAdding(a => ({ ...a, note: e.target.value }))} />
        <button type="submit" className="lu-btn" disabled={!adding.value.trim() || !!busy}>{busy === 'add' ? s.saving : `+ ${s.filterAdd}`}</button>
      </form>

      <div className="lu-filter-forward">
        <label htmlFor="lu-filter-forward">{s.filterForwardLabel}</label>
        <p className="lu-hint">{s.filterForwardHint}</p>
        <div className="lu-filter-add">
          <input id="lu-filter-forward" type="email" inputMode="email" autoComplete="off" placeholder={s.filterForwardPlaceholder}
            value={forward} onChange={e => setForward(e.target.value)} />
          <button type="button" className="lu-btn" disabled={forward.trim() === filters.forwardTo || !!busy}
            onClick={() => run('forward', () => saveFilterForward(forward.trim()))}>{busy === 'forward' ? s.saving : s.save}</button>
        </div>
        {!filters.forwardTo && <p className="lu-hint">{s.filterForwardNone}</p>}
      </div>
      {error && <p className="lu-field-error">{s.errorPrefix} {error}</p>}
      </div>
    </Section>
  );
}
