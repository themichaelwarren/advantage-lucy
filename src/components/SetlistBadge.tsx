import { ListMusic } from 'lucide-react';

/** "This show has a setlist": the same list icon as the admin, with a word so it's clear. */
export default function SetlistBadge({ locale }: { locale: string }) {
  const label = locale === 'ja' ? 'セトリ' : 'Setlist';
  return (
    <span className="tl-setlist" title={locale === 'ja' ? 'セットリストあり' : 'Has a setlist'}>
      <ListMusic aria-hidden="true" strokeWidth={2.2} />
      <span>{label}</span>
    </span>
  );
}
