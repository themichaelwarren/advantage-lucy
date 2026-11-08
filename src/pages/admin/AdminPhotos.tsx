import { Link } from 'react-router-dom';
import { useAllPhotos } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import type { SplashPhoto } from '../../types';
import { photoToRow } from '../../utils/adminRows';
import ListToolbar, { useListPrefs, SwitchCell, SaveStateCell } from '../../components/admin/ListToolbar';
import { useQuickEdit } from '../../components/admin/useQuickEdit';

type Filter = 'all' | 'onsite' | 'hidden';
type View = 'grid' | 'table';

export default function AdminPhotos() {
  const { s, locale, prefix } = useAdminT();
  const { photos: loaded, loading } = useAllPhotos();
  const { items: photos, save: quickSave, rowState } = useQuickEdit<SplashPhoto>(loaded, 'Photos', photoToRow);
  const ui = useListPrefs<Filter, 'none', View>('photos', { filter: 'all', sort: 'none', view: 'grid' });
  const view = ui.view || 'grid';

  /** Only one About-page photo: turning it on turns it off for the others. */
  function save(id: string, patch: Partial<SplashPhoto>) {
    const others = patch.profile_photo === 'yes'
      ? photos.filter(p => p.id !== id && p.profile_photo === 'yes').map(p => ({ ...p, profile_photo: '' }))
      : [];
    return quickSave(id, patch, others);
  }

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  const caption = (p: SplashPhoto) => (locale === 'ja' ? p.caption_ja || p.caption_en : p.caption_en || p.caption_ja);
  const q = ui.query.trim().toLowerCase();
  const list = photos
    .filter(p => ui.filter === 'all' ? true : ui.filter === 'hidden' ? p.status === 'private' : p.status !== 'private')
    .filter(p => !q || `${p.caption_en || ''} ${p.caption_ja || ''}`.toLowerCase().includes(q));

  return (
    <>
      <div className="lu-page-head">
        <div>
          <h1>{s.photosTitle} <span className="lu-count">{photos.length}</span></h1>
          <p className="lu-hint">{s.photosHint}</p>
        </div>
        <Link to={`${prefix}/photos/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addPhoto}</Link>
      </div>

      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'onsite', label: s.filterOnSite }, { value: 'hidden', label: s.filterHidden }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        views={[{ value: 'grid', label: `▦ ${s.viewGrid}` }, { value: 'table', label: `☰ ${s.viewTable}` }]}
        view={view} onView={v => ui.setView(v as View)}
        shown={list.length} total={photos.length}
      />

      {list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : view === 'grid' ? (
        <div className="lu-photo-grid">
          {list.map(p => (
            <Link key={p.id} to={`${prefix}/photos/${p.id}`} className={`lu-photo-card${p.status === 'private' ? ' is-hidden' : ''}`}>
              <img src={p.image_url} alt={caption(p) || ''} loading="lazy" />
              <span className="lu-photo-meta">
                {caption(p) && <span>{caption(p)}</span>}
                {p.profile_photo === 'yes' && <span className="lu-tag is-ok">{s.onAbout}</span>}
                {p.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="lu-table-wrap">
          <table className="lu-table">
            <thead>
              <tr>
                <th>{s.colPhoto}</th>
                <th>{s.caption} · {s.english}</th>
                <th>{s.caption} · {s.japanese}</th>
                <th className="lu-td-center">{s.colOnSite}</th>
                <th className="lu-td-center">{s.onAbout}</th>
                <th aria-label={s.edit} />
              </tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className={p.status === 'private' ? 'is-hidden' : ''}>
                  <td className="lu-td-photo"><img src={p.image_url} alt="" loading="lazy" /></td>
                  {(['caption_en', 'caption_ja'] as const).map(field => (
                    <td key={field}>
                      <input
                        className="lu-cell-input"
                        lang={field === 'caption_ja' ? 'ja' : undefined}
                        defaultValue={p[field] || ''}
                        aria-label={`${s.caption} · ${field === 'caption_ja' ? s.japanese : s.english}`}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        onBlur={e => { if (e.target.value !== (p[field] || '')) save(p.id, { [field]: e.target.value }); }}
                      />
                    </td>
                  ))}
                  <td className="lu-td-center">
                    <SwitchCell checked={p.status !== 'private'} label={s.colOnSite} onChange={() => save(p.id, { status: p.status === 'private' ? 'published' : 'private' })} />
                  </td>
                  <td className="lu-td-center">
                    <SwitchCell checked={p.profile_photo === 'yes'} label={s.onAbout} onChange={() => save(p.id, { profile_photo: p.profile_photo === 'yes' ? '' : 'yes' })} />
                  </td>
                  <SaveStateCell s={s} state={rowState[p.id]} editHref={`${prefix}/photos/${p.id}`} renderLink={(href, label) => <Link to={href} className="lu-btn lu-btn-quiet">{label}</Link>} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
