import { Link, useParams } from 'react-router-dom';
import { useAllPhotos } from '../../hooks/useSheetData';
import { t, type Locale } from '../../i18n/translations';

export default function AdminPhotos() {
  const { locale: rawLocale = 'en' } = useParams<{ locale: string }>();
  const locale = (rawLocale === 'ja' ? 'ja' : 'en') as Locale;
  const s = t(locale).admin;
  const prefix = `/${locale}/admin`;
  const { photos, loading } = useAllPhotos();

  if (loading) return <p>{s.loading}</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>{s.splashPhotos} ({photos.length})</h1>
        <Link to={`${prefix}/photos/new`} className="admin-btn admin-btn-primary">
          {s.newPhoto}
        </Link>
      </div>

      <div className="admin-photo-grid">
        {photos.map(photo => (
          <Link key={photo.id} to={`${prefix}/photos/${photo.id}`} className="admin-photo-card">
            <div className="admin-photo-thumb">
              {photo.image_url ? (
                <img src={photo.image_url} alt={photo.caption_en || ''} />
              ) : (
                <span>No image</span>
              )}
            </div>
            <div className="admin-photo-info">
              <span className="admin-photo-caption">{photo.caption_en || photo.id}</span>
              <span className={`admin-status ${photo.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                {photo.status === 'private' ? s.draft : s.live}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {photos.length === 0 && <p className="admin-empty">No splash photos yet. Add one to enable the entrance page.</p>}
    </>
  );
}
