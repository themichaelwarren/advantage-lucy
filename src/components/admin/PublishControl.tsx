import type { AdminStrings } from '../../i18n/admin';
import { nowInJapan, normDateTime } from '../../utils/showDates';

/** "2026-11-20T18:00" → "2026-11-20 18:00" */
export const showDateTime = (at: string) => normDateTime(at).replace('T', ' ');

/** Tomorrow at noon, Japan time: a sensible starting point for "schedule". */
function tomorrowNoon(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return `${nowInJapan(d).slice(0, 10)}T12:00`;
}

/**
 * When a post appears on the site: now, at a set time (Japan time), or not
 * at all (hidden). Stored as status ('published' | 'private') plus
 * publish_at; the server holds scheduled posts back until their time.
 */
export default function PublishControl({ s, status, publishAt, onChange }: {
  s: AdminStrings;
  status: string;
  publishAt: string;
  onChange: (next: { status: string; publish_at: string }) => void;
}) {
  const mode = status === 'private' ? 'hidden' : normDateTime(publishAt) ? 'later' : 'now';
  const at = normDateTime(publishAt);
  const past = !!at && at <= nowInJapan();

  const pick = (m: 'now' | 'later' | 'hidden') => {
    if (m === 'now') onChange({ status: 'published', publish_at: '' });
    if (m === 'later') onChange({ status: 'published', publish_at: at || tomorrowNoon() });
    if (m === 'hidden') onChange({ status: 'private', publish_at: '' });
  };

  return (
    <div className="lu-publish">
      <p className="lu-publish-label">{s.goLive}</p>
      <div className="lu-chips" role="radiogroup" aria-label={s.goLive}>
        {(['now', 'later', 'hidden'] as const).map(m => (
          <button
            key={m} type="button" role="radio" aria-checked={mode === m}
            className={`lu-pill${mode === m ? ' is-on' : ''}`}
            onClick={() => pick(m)}
          >
            {m === 'now' ? s.goLiveNow : m === 'later' ? s.goLiveLater : s.goLiveHidden}
          </button>
        ))}
      </div>
      {mode === 'later' && (
        <label className="lu-publish-when">
          <input
            type="datetime-local"
            value={at}
            onChange={e => onChange({ status: 'published', publish_at: e.target.value })}
            aria-label={s.goLiveLater}
          />
          <span className="lu-hint">{s.japanTime}</span>
        </label>
      )}
      <p className="lu-hint lu-publish-state">
        {mode === 'now' && s.goLiveNowHint}
        {mode === 'hidden' && s.goLiveHiddenHint}
        {mode === 'later' && (past
          ? s.liveSince.replace('{at}', showDateTime(at))
          : s.goesLiveAt.replace('{at}', showDateTime(at)))}
      </p>
    </div>
  );
}
