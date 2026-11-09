import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * A small "Edit" button on the public site, only in a browser that has
 * signed in to the admin (fans never see it). It's just a link: the admin
 * itself checks every request on the server, so showing it grants nothing.
 * On a show, song, release, venue, news or blog page it opens that item's
 * admin page; elsewhere the admin home.
 */
const EDITABLE = ['events', 'songs', 'releases', 'venues', 'news', 'blog'];

function signedInAsAdmin(): boolean {
  try {
    const s = JSON.parse(localStorage.getItem('admin-session') || 'null');
    return !!s?.user?.email;
  } catch {
    return false;
  }
}

export default function AdminShortcut({ locale }: { locale: 'en' | 'ja' }) {
  const { pathname } = useLocation();
  const [show, setShow] = useState(signedInAsAdmin);
  // Signing in or out in another tab updates this one too
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'admin-session') setShow(signedInAsAdmin()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  if (!show) return null;

  // /ja/events/2005-09-09-tokyo → /ja/admin/events/2005-09-09-tokyo
  const [, , section, id] = pathname.split('/');
  const editable = EDITABLE.includes(section);
  const to = editable ? `/${locale}/admin/${section}${id ? `/${id}` : ''}` : `/${locale}/admin`;
  const label = editable && id ? (locale === 'ja' ? '編集' : 'Edit') : (locale === 'ja' ? '管理画面' : 'Admin');

  return (
    <Link to={to} className="admin-shortcut" title={locale === 'ja' ? '管理画面で開く' : 'Open in the admin'}>
      <span aria-hidden="true">✎</span> {label}
    </Link>
  );
}
