import { Link } from 'react-router-dom';

/** "← Discography" above a detail page's title, back to its list. */
export default function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <nav className="page-back" aria-label={label}>
      <Link to={to}><span aria-hidden="true">←</span> {label}</Link>
    </nav>
  );
}
