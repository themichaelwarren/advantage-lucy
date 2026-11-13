import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminStrings } from '../../i18n/admin';
import { renameItem } from '../../services/adminService';
import { EditDialog, errorText } from './ui';
import { useAdminT } from '../../i18n/admin';

/**
 * Change a show's, venue's, song's or release's address (its id): the
 * setlist, videos, links and so on move with it, and the old address
 * keeps working (it forwards to the new one). See functions/lib/rename.ts.
 */
const PATHS = { event: 'events', venue: 'venues', song: 'songs', album: 'releases' } as const;
export type AddressKind = keyof typeof PATHS;

/** "Shiroi Asa (Live)" → "shiroi-asa-live" */
const slugify = (t: string) => t.normalize('NFKC').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export default function AddressDialog({ s, kind, id, open, onClose }: {
  s: AdminStrings; kind: AddressKind; id: string; open: boolean; onClose: () => void;
}) {
  const { prefix } = useAdminT();
  const navigate = useNavigate();
  const [value, setValue] = useState(id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setValue(id); setError(''); } }, [open, id]);
  const next = slugify(value);

  const save = async () => {
    if (!next || next === id) return;
    setSaving(true); setError('');
    try {
      const newId = await renameItem(kind, id, next);
      onClose();
      navigate(`${prefix}/${PATHS[kind]}/${newId}`, { replace: true });
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  return (
    <EditDialog s={s} title={s.addrTitle} open={open} saving={saving} error={error} dirty={!!next && next !== id} saveLabel={s.addrSave}
      onClose={() => { if (!saving) onClose(); }} onSave={save}>
      <p className="lu-hint">{s.addrHint}</p>
      <label className="lu-field">
        <span>{s.addrLabel}</span>
        <span className="lu-addr">
          <span className="lu-addr-prefix">/{PATHS[kind]}/</span>
          <input value={value} onChange={e => setValue(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
        </span>
        {next && next !== value.trim() && <span className="lu-hint">→ /{PATHS[kind]}/<strong>{next}</strong></span>}
      </label>
    </EditDialog>
  );
}

export { movedTo } from '../../utils/formerIds';
