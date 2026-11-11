import { useEffect, useRef, useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { parseFormerNames, formatFormerNames, type FormerName } from '../../../functions/lib/venueNames';
import Icon from './Icon';

/**
 * A venue's old names, each with the month it was used until
 * (functions/lib/venueNames.ts). Half-typed rows stay on screen; only
 * complete ones (a month and a name) are saved.
 */
export default function FormerNames({ s, value, onChange }: { s: AdminStrings; value: string; onChange: (v: string) => void }) {
  const [rows, setRows] = useState<FormerName[]>(() => parseFormerNames(value));
  const sent = useRef(value);
  // Changed from outside (a discard, a reload): start again from it
  useEffect(() => { if (value !== sent.current) { sent.current = value; setRows(parseFormerNames(value)); } }, [value]);

  const update = (next: FormerName[]) => {
    setRows(next);
    const out = formatFormerNames(next);
    sent.current = out;
    onChange(out);
  };
  const setRow = (i: number, patch: Partial<FormerName>) => update(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="lu-former">
      {rows.length > 0 && (
        <ul className="lu-former-rows">
          {rows.map((r, i) => (
            <li key={i}>
              <label className="lu-former-until">
                <span>{s.formerUntil}</span>
                <input type="month" value={r.until.slice(0, 7)} onChange={e => setRow(i, { until: e.target.value })} />
              </label>
              <input aria-label={`${s.venueName} · ${s.english}`} placeholder={s.english} value={r.name_en} onChange={e => setRow(i, { name_en: e.target.value })} />
              <input aria-label={`${s.venueName} · ${s.japanese}`} placeholder={s.japanese} lang="ja" value={r.name_ja} onChange={e => setRow(i, { name_ja: e.target.value })} />
              <button type="button" className="lu-icon-btn" aria-label={s.remove} title={s.remove} onClick={() => update(rows.filter((_, j) => j !== i))}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="lu-link-btn" onClick={() => setRows(r => [...r, { until: '', name_en: '', name_ja: '' }])}>+ {s.formerAdd}</button>
    </div>
  );
}
