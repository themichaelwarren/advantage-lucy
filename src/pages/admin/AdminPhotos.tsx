import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllPhotos, useAllEvents } from '../../hooks/useSheetData';
import { reorderRows } from '../../services/adminService';
import { errorText, InfoHint } from '../../components/admin/ui';
import { showLinkId } from '../../utils/photoLinks';
import { todayInJapan } from '../../utils/showDates';
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
  const { items: photos, setItems, save: quickSave, rowState } = useQuickEdit<SplashPhoto>(loaded, 'Photos', photoToRow);
  const { events } = useAllEvents();
  // Order: the sheet's row order is the order on the home page
  const [orderState, setOrderState] = useState<'' | 'saving' | 'saved' | string>('');
  const dragId = useRef<string | null>(null);
  // Latest list, for the end of a pointer drag (its handler may be from an earlier render)
  const photosRef = useRef<SplashPhoto[]>([]);
  const beforeDrag = useRef<SplashPhoto[] | null>(null);

  photosRef.current = photos;

  async function saveOrder(next: SplashPhoto[], before: SplashPhoto[]) {
    if (next.map(p => p.id).join() === before.map(p => p.id).join()) return;
    setOrderState('saving');
    try {
      await reorderRows('Photos', next.map(p => p.id));
      setOrderState('saved');
      window.setTimeout(() => setOrderState(st => (st === 'saved' ? '' : st)), 2500);
    } catch (err) {
      setItems(before);
      setOrderState(errorText(err));
    }
  }
  function moveBy(id: string, dir: -1 | 1) {
    const i = photos.findIndex(p => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    saveOrder(next, photos);
  }
  /** While dragging: move the dragged photo to where the pointer is. */
  function dragOver(overId: string) {
    const from = dragId.current;
    if (!from || from === overId) return;
    const current = photosRef.current;
    const i = current.findIndex(p => p.id === from);
    const j = current.findIndex(p => p.id === overId);
    if (i < 0 || j < 0) return;
    const next = [...current];
    next.splice(j, 0, next.splice(i, 1)[0]);
    photosRef.current = next;
    setItems(next);
  }

  /** Drag-to-reorder, shared by the grid and the table. */
  const dragProps = (p: SplashPhoto) => ({
    onDragStart: (e: React.DragEvent<HTMLElement>) => { dragId.current = p.id; beforeDrag.current = photos; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('is-dragging'); },
    onDragOver: (e: React.DragEvent<HTMLElement>) => { if (!dragId.current) return; e.preventDefault(); dragOver(p.id); },
    onDrop: (e: React.DragEvent<HTMLElement>) => e.preventDefault(),
    onDragEnd: (e: React.DragEvent<HTMLElement>) => {
      e.currentTarget.classList.remove('is-dragging');
      const before = beforeDrag.current;
      dragId.current = null; beforeDrag.current = null;
      if (before) saveOrder(photos, before);
    },
  });
  /**
   * Table rows move by their ⠿ handle, with pointer events rather than
   * HTML drag-and-drop so it works the same with a finger as with a mouse.
   * Arrow keys on the handle move a row too.
   */
  const handleProps = (p: SplashPhoto) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragId.current = p.id;
      beforeDrag.current = photosRef.current;
      const row = () => document.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(p.id)}"]`);
      row()?.classList.add('is-dragging');
      // Listen on the whole page: the row moves in the page as you drag,
      // which would drop a pointer capture on the handle itself
      const move = (ev: PointerEvent) => {
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('tr[data-id]');
        if (over?.dataset.id) dragOver(over.dataset.id);
      };
      const end = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        row()?.classList.remove('is-dragging');
        const before = beforeDrag.current;
        dragId.current = null; beforeDrag.current = null;
        if (before) saveOrder(photosRef.current, before);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const target = e.currentTarget;
        moveBy(p.id, e.key === 'ArrowUp' ? -1 : 1);
        requestAnimationFrame(() => target.focus());
      }
    },
  });

  const today = todayInJapan();
  /** What a photo links to, for the tag on its card */
  const linkTag = (p: SplashPhoto): { text: string; past?: boolean } | null => {
    if (!p.link) return null;
    const showId = showLinkId(p.link);
    if (!showId) return { text: p.link.replace(/^https?:\/\//, '') };
    const e = events.find(x => x.id === showId);
    if (!e) return { text: showId };
    const venue = locale === 'ja' ? e.venue_ja || e.venue_en : e.venue_en || e.venue_ja;
    return { text: `${e.date.slice(5).replace('-', '/')} ${venue}`, past: (e.end_date || e.date) < today };
  };
  const ui = useListPrefs<Filter, 'none', View>('photos', { filter: 'all', sort: 'none', view: 'grid' });
  const view = ui.view || 'grid';

  /** Only one About-page photo: turning it on turns it off for the others. */
  function save(id: string, patch: Partial<SplashPhoto>) {
    // …and only one share image, the same way
    const others = patch.profile_photo === 'yes'
      ? photos.filter(p => p.id !== id && p.profile_photo === 'yes').map(p => ({ ...p, profile_photo: '' }))
      : patch.share_image === 'yes'
        ? photos.filter(p => p.id !== id && p.share_image === 'yes').map(p => ({ ...p, share_image: '' }))
        : [];
    return quickSave(id, patch, others);
  }

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  const caption = (p: SplashPhoto) => (locale === 'ja' ? p.caption_ja || p.caption_en : p.caption_en || p.caption_ja);
  const q = ui.query.trim().toLowerCase();
  const canReorder = ui.filter === 'all' && !q;
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

      <p className={`lu-hint lu-order-state${orderState && orderState !== 'saving' && orderState !== 'saved' ? ' is-error' : ''}`} role="status">
          {orderState === 'saving' ? s.photoOrderSaving
            : orderState === 'saved' ? `✓ ${s.photoOrderSaved}`
            : orderState ? `${s.errorPrefix} ${orderState}`
            : !canReorder ? s.photoOrderFiltered : ''}
      </p>

      {list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : view === 'grid' ? (
        <div className="lu-photo-grid">
          {list.map((p, i) => {
            const tag = linkTag(p);
            return (
              <div
                key={p.id}
                className={`lu-photo-card${p.status === 'private' ? ' is-hidden' : ''}${canReorder ? ' is-movable' : ''}`}
                draggable={canReorder}
                {...(canReorder ? dragProps(p) : {})}
              >
                <Link to={`${prefix}/photos/${p.id}`} className="lu-photo-card-link" draggable={false}>
                  <img src={p.image_url} alt={caption(p) || ''} loading="lazy" draggable={false} />
                  <span className="lu-photo-meta">
                    {canReorder && <span className="lu-photo-num" aria-hidden="true">{i + 1}</span>}
                    {caption(p) && <span className="lu-photo-caption">{caption(p)}</span>}
                    {tag && <span className={`lu-tag ${tag.past ? 'is-muted' : 'is-link'}`} title={s.photoLinkedTo}>→ {tag.text}{tag.past ? ` · ${s.photoPastShow}` : ''}</span>}
                    {p.profile_photo === 'yes' && <span className="lu-tag is-ok">{s.onAbout}</span>}
                    {p.share_image === 'yes' && <span className="lu-tag is-ok">{s.shareImageTag}</span>}
                    {p.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
                  </span>
                </Link>
                {canReorder && (
                  <span className="lu-photo-move">
                    <button type="button" className="lu-icon-btn" onClick={() => moveBy(p.id, -1)} disabled={i === 0} aria-label={`${s.moveEarlier}: ${caption(p) || i + 1}`}>‹</button>
                    <button type="button" className="lu-icon-btn" onClick={() => moveBy(p.id, 1)} disabled={i === list.length - 1} aria-label={`${s.moveLater}: ${caption(p) || i + 1}`}>›</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lu-table-wrap">
          <table className="lu-table">
            <thead>
              <tr>
                {canReorder && <th className="lu-td-order" aria-label={s.sortBy} />}
                <th>{s.colPhoto}</th>
                <th>{s.caption} · {s.english}</th>
                <th>{s.caption} · {s.japanese}</th>
                <th className="lu-td-center">{s.colOnSite}</th>
                <th className="lu-td-center lu-th-hint">{s.onAbout}<InfoHint text={s.onAboutTip} /></th>
                <th className="lu-td-center lu-th-hint">{s.shareImageTag}<InfoHint text={s.shareImageTip} /></th>
                <th aria-label={s.edit} />
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id} data-id={p.id} className={p.status === 'private' ? 'is-hidden' : ''}>
                  {canReorder && (
                    <td className="lu-td-order">
                      <span className="lu-order-cell">
                        <button
                          type="button"
                          className="lu-row-grip"
                          aria-label={`${s.dragToMove}: ${caption(p) || i + 1}`}
                          title={s.dragToMove}
                          {...handleProps(p)}
                        >
                          <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
                            {[3, 8, 13].map(y => [2.5, 7.5].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
                          </svg>
                        </button>
                        <span className="lu-photo-num">{i + 1}</span>
                      </span>
                    </td>
                  )}
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
                  <td className="lu-td-center">
                    <SwitchCell checked={p.share_image === 'yes'} label={s.shareImageTag} onChange={() => save(p.id, { share_image: p.share_image === 'yes' ? '' : 'yes' })} />
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
