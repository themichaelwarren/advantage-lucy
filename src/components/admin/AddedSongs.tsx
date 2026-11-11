import Icon from './Icon';
import { Link } from 'react-router-dom';
import type { Song } from '../../types';
import type { AdminStrings } from '../../i18n/admin';

/** After saving: "Added to Songs: X, Y" with links to fill in credits and lyrics. */
export default function AddedSongs({ s, songs, prefix, onClose }: {
  s: AdminStrings;
  songs: Song[];
  prefix: string;
  onClose: () => void;
}) {
  if (!songs.length) return null;
  return (
    <p className="lu-note lu-added-songs" role="status">
      <span>
        ✓ {s.songsAdded}{' '}
        {songs.map((x, i) => (
          <span key={x.id}>{i > 0 && ', '}<Link to={`${prefix}/songs/${x.id}`}>{x.title}</Link></span>
        ))}
        <br />
        <span className="lu-hint">{s.songsAddedHint}</span>
      </span>
      <button type="button" className="lu-icon-btn" onClick={onClose} aria-label={s.close}><Icon name="close" /></button>
    </p>
  );
}
