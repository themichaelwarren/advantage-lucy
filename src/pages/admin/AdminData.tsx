import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAdminT, type AdminStrings } from '../../i18n/admin';
import { useAllEvents, useAllSetlists, useAllSongs } from '../../hooks/useSheetData';
import type { SetlistEntry, Song } from '../../types';
import { Section } from '../../components/admin/ui';
import Icon from '../../components/admin/Icon';
import { normalize } from '../../utils/text';
import { songTitle, compareSongs } from '../../utils/songTitles';
import { todayInJapan } from '../../utils/showDates';
import { pickAccent } from '../../utils/palette';

/**
 * データ: the archive in numbers, for the band (admin only). Everything is
 * counted from the setlists we have, and the page says how many shows
 * that is, so nobody mistakes "in 40 setlists" for "played 40 times ever".
 */

interface Play { key: string; title: string; song?: Song; dates: string[] }
type Locale = 'en' | 'ja';

const year = (d: string) => d.slice(0, 4);
const dot = (d: string) => d.replace(/-/g, '.');
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
/** "1", "2" … then encores ("e", "e2") last */
const setRank = (set: string) => (/^e/i.test(set || '') ? 1000 + (parseInt(set.slice(1), 10) || 0) : parseInt(set, 10) || 1);
const isEncore = (set: string) => /^e/i.test(set || '');
/** "???", "新曲（インスト）", "untitled": a song nobody had a name for yet */
const isPlaceholder = (title: string) => /^[?？]|^新曲|^untitled|^unknown|^tba\b/i.test(title.trim());

export function useStats(locale: Locale) {
  const { events, loading: l1 } = useAllEvents();
  const { setlists, loading: l2 } = useAllSetlists();
  const { songs, loading: l3 } = useAllSongs();
  const stats = useMemo(() => {
    const today = todayInJapan();
    const past = events.filter(e => (e.end_date || e.date) < today).sort((a, b) => a.date.localeCompare(b.date));
    const byId = new Map(past.map(e => [e.id, e]));
    const songBy = new Map(songs.filter(x => x.title).map(x => [normalize(x.title), x]));
    const byTitle = compareSongs(locale);
    const cmpPlay = (a: { song?: Song; title: string }, b: { song?: Song; title: string }) => byTitle(a.song || { title: a.title }, b.song || { title: b.title });

    // Each past show's setlist, in running order
    const shows = new Map<string, SetlistEntry[]>();
    for (const r of setlists) {
      if (!byId.has(r.event) || !r.song?.trim()) continue;
      if (isPlaceholder(r.song) && !songBy.has(normalize(r.song))) continue;
      (shows.get(r.event) || shows.set(r.event, []).get(r.event)!).push(r);
    }
    for (const rows of shows.values()) rows.sort((a, b) => setRank(a.set) - setRank(b.set) || Number(a.order) - Number(b.order));
    const withSetlist = past.filter(e => shows.has(e.id));

    // Every song's shows, oldest first (a song twice in one show counts once)
    const plays = new Map<string, Play>();
    let performances = 0;
    for (const e of withSetlist) {
      const seen = new Set<string>();
      for (const r of shows.get(e.id)!) {
        performances++;
        const key = normalize(r.song);
        if (seen.has(key)) continue;
        seen.add(key);
        const p = plays.get(key) || { key, title: r.song.trim(), song: songBy.get(key), dates: [] };
        p.dates.push(e.date);
        plays.set(key, p);
      }
    }
    const all = [...plays.values()];
    const mostPlayed = [...all].sort((a, b) => b.dates.length - a.dates.length || cmpPlay(a, b));

    // Shows per year, every year from the first to now (empty years show as gaps)
    const perYear: { year: string; shows: number; setlists: number }[] = [];
    if (past.length) {
      for (let y = +year(past[0].date); y <= +year(today); y++) {
        const ys = past.filter(e => year(e.date) === String(y));
        perYear.push({ year: String(y), shows: ys.length, setlists: ys.filter(e => shows.has(e.id)).length });
      }
    }

    // Each year's top three (years with two or more setlists)
    const byYear = perYear.filter(y => y.setlists >= 2).map(y => {
      const top = all
        .map(p => ({ ...p, n: p.dates.filter(d => year(d) === y.year).length }))
        .filter(p => p.n > 1)
        .sort((a, b) => b.n - a.n || cmpPlay(a, b))
        .slice(0, 3);
      return { ...y, top };
    }).filter(y => y.top.length).reverse();

    // Openers, closers (last before the encore), encores
    const tally = (pick: (rows: SetlistEntry[]) => SetlistEntry[]) => {
      const c = new Map<string, { title: string; song?: Song; n: number }>();
      for (const rows of shows.values()) {
        for (const r of new Map(pick(rows).map(r => [normalize(r.song), r])).values()) {
          const key = normalize(r.song);
          const x = c.get(key) || { title: r.song.trim(), song: songBy.get(key), n: 0 };
          x.n++;
          c.set(key, x);
        }
      }
      return [...c.values()].filter(x => x.n > 1).sort((a, b) => b.n - a.n || cmpPlay(a, b)).slice(0, 5);
    };
    const openers = tally(rows => rows.slice(0, 1));
    const closers = tally(rows => { const main = rows.filter(r => !isEncore(r.set)); return rows.some(r => isEncore(r.set)) && main.length ? [main[main.length - 1]] : []; });
    const encores = tally(rows => rows.filter(r => isEncore(r.set)));

    // Debuts: the year each song first shows up
    const debutMap = new Map<string, Play[]>();
    for (const p of all) {
      const y = year(p.dates[0]);
      debutMap.set(y, [...(debutMap.get(y) || []), p]);
    }
    const debuts = [...debutMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([y, ps]) => ({ year: y, songs: ps.sort(cmpPlay) }));

    // Longest gaps between two shows a song was played at
    const gaps = all.filter(p => p.dates.length > 1).map(p => {
      let best = { from: '', to: '', d: 0 };
      for (let i = 1; i < p.dates.length; i++) {
        const d = days(p.dates[i - 1], p.dates[i]);
        if (d > best.d) best = { from: p.dates[i - 1], to: p.dates[i], d };
      }
      return { ...p, gap: best };
    }).sort((a, b) => b.gap.d - a.gap.d).slice(0, 10);

    // Played 3+ times, longest since last played
    const notLately = all.filter(p => p.dates.length >= 3)
      .sort((a, b) => a.dates[a.dates.length - 1].localeCompare(b.dates[b.dates.length - 1]) || cmpPlay(a, b)).slice(0, 10);

    // Venues by number of shows
    const venueMap = new Map<string, { id: string; name: string; n: number }>();
    for (const e of past) {
      const id = e.venue_id || e.venue_ja || e.venue_en;
      if (!id) continue;
      const name = (locale === 'ja' ? e.venue_ja || e.venue_en : e.venue_en || e.venue_ja) || id;
      const v = venueMap.get(id) || { id: e.venue_id || '', name, n: 0 };
      v.n++;
      venueMap.set(id, v);
    }
    const venues = [...venueMap.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, locale)).slice(0, 10);

    const neverLive = songs.filter(x => x.id && x.title && !plays.has(normalize(x.title))).sort(byTitle);

    return {
      past, withSetlist, performances, plays: all, mostPlayed, perYear, byYear,
      openers, closers, encores, debuts, gaps, notLately, venues, neverLive,
      firstYear: past[0] ? year(past[0].date) : '', lastYear: past.length ? year(past[past.length - 1].date) : '',
    };
  }, [events, setlists, songs, locale]);
  return { stats, loading: l1 || l2 || l3 };
}

// ---------- pieces ----------

function SongName({ p, prefix, locale }: { p: { title: string; song?: Song }; prefix: string; locale: Locale }) {
  return p.song?.id
    ? <Link to={`${prefix}/songs/${p.song.id}`}>{songTitle(p.song, locale)}</Link>
    : <span>{p.title}</span>;
}

function Tile({ n, label, sub }: { n: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <li className="lu-data-tile">
      <strong>{n}</strong>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </li>
  );
}

/** Shows per year: a column per year, the part with a setlist in ink. */
function YearColumns({ data, s }: { data: { year: string; shows: number; setlists: number }[]; s: AdminStrings }) {
  const [tip, setTip] = useState<{ i: number } | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map(d => d.shows));
  const peak = data.findIndex(d => d.shows === max);
  const labelEvery = data.length > 24 ? 5 : data.length > 12 ? 2 : 1;
  const tipFor = (d: typeof data[number]) => `${d.year} · ${s.dataShowsN.replace('{n}', String(d.shows))} · ${s.dataSetlistsN.replace('{n}', String(d.setlists))}`;
  return (
    <>
      <div className="lu-data-legend" aria-hidden="true">
        <span><i className="is-set" /> {s.dataWithSetlist}</span>
        <span><i className="is-none" /> {s.dataNoSetlist}</span>
      </div>
      <div className="lu-data-cols" role="img" aria-label={s.dataPerYear} onMouseLeave={() => setTip(null)}>
        {data.map((d, i) => (
          <div key={d.year} className={`lu-data-col${tip?.i === i ? ' is-hover' : ''}`} tabIndex={0}
            aria-label={tipFor(d)} onMouseEnter={() => setTip({ i })} onFocus={() => setTip({ i })} onBlur={() => setTip(null)}
            onClick={() => setTip(t => (t?.i === i ? null : { i }))}>
            <div className="lu-data-stack" style={{ height: `${(d.shows / max) * 100}%` }}>
              {i === peak && <span className="lu-data-peak">{d.shows}</span>}
              {d.shows - d.setlists > 0 && <span className="is-none" style={{ flexGrow: d.shows - d.setlists }} />}
              {d.setlists > 0 && <span className="is-set" style={{ flexGrow: d.setlists }} />}
            </div>
            <span className="lu-data-x">{(i % labelEvery === 0 || i === data.length - 1) ? `’${d.year.slice(2)}` : ''}</span>
            {tip?.i === i && <span className={`lu-data-tip${i > data.length * 0.6 ? ' is-left' : ''}`} role="status">{tipFor(d)}</span>}
          </div>
        ))}
      </div>
      <button type="button" className="lu-link-btn lu-data-tablebtn" onClick={() => setTable(t => !t)}><Icon name="table" /> {s.dataAsTable}</button>
      {table && (
        <table className="lu-data-table">
          <thead><tr><th>{s.dataYear}</th><th>{s.dataShows}</th><th>{s.dataWithSetlist}</th></tr></thead>
          <tbody>{data.map(d => <tr key={d.year}><td>{d.year}</td><td>{d.shows}</td><td>{d.setlists}</td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}

/** A ranked list with a bar for the count. */
function Ranked<T extends { n: number }>({ rows, name, sub, s, max }: {
  rows: T[]; name: (r: T) => ReactNode; sub?: (r: T) => ReactNode; s: AdminStrings; max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map(r => r.n));
  return (
    <ol className="lu-data-rank">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="lu-data-rank-n">{i + 1}</span>
          <span className="lu-data-rank-name">{name(r)}{sub && <small>{sub(r)}</small>}</span>
          <span className="lu-data-rank-bar" aria-hidden="true"><span style={{ width: `${(r.n / top) * 100}%` }} /></span>
          <span className="lu-data-rank-v">{s.dataTimes.replace('{n}', String(r.n))}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A taste of the data page for the admin home: the shows-per-year shape,
 * three numbers, and the way in. The whole card is the link.
 */
export function DataTeaser() {
  const { s, locale, prefix } = useAdminT();
  const { stats: d, loading } = useStats(locale);
  const [accent] = useState(() => pickAccent(getComputedStyle(document.documentElement).getPropertyValue('--pop').trim()));
  if (loading || !d.past.length) return null;
  const max = Math.max(1, ...d.perYear.map(y => y.shows));
  const top = d.mostPlayed[0];
  return (
    <section className="lu-list-group">
      <h2>{s.dataTitle}</h2>
      <Link to={`${prefix}/data`} className="lu-data-teaser" style={{ '--data-ink': accent } as CSSProperties}>
        <span className="lu-data-mini" aria-hidden="true">
          {d.perYear.map(y => (
            <span key={y.year} className="lu-data-mini-col" style={{ height: `${(y.shows / max) * 100}%` }}>
              {y.shows - y.setlists > 0 && <i className="is-none" style={{ flexGrow: y.shows - y.setlists }} />}
              {y.setlists > 0 && <i className="is-set" style={{ flexGrow: y.setlists }} />}
            </span>
          ))}
          <small className="lu-data-mini-x"><span>{d.firstYear}</span><span>{year(todayInJapan())}</span></small>
        </span>
        <span className="lu-data-teaser-facts">
          <span><strong>{d.past.length}</strong>{s.dataShows}</span>
          <span><strong>{d.plays.length}</strong>{s.dataSongsLive}</span>
          {top && <span><strong className="is-text">{top.song ? songTitle(top.song, locale) : top.title}</strong>{s.dataMostPlayed} · {s.dataTimes.replace('{n}', String(top.dates.length))}</span>}
        </span>
        <span className="lu-data-teaser-go">{s.dataSeeAll} <span aria-hidden="true">→</span></span>
      </Link>
    </section>
  );
}

const MOST_SHOWN = 20;
const YEARS_SHOWN = 6;

export default function AdminData() {
  const { s, locale, prefix } = useAdminT();
  const { stats: d, loading } = useStats(locale);
  const [allMost, setAllMost] = useState(false);
  const [allYears, setAllYears] = useState(false);
  const [allDebuts, setAllDebuts] = useState(false);
  // A new colour for the bars each visit, as the public pages do (never the one the page already has)
  const [accent, setAccent] = useState(() => pickAccent(getComputedStyle(document.documentElement).getPropertyValue('--pop').trim()));

  if (loading) return <p className="lu-loading">{s.loading}</p>;
  const pct = d.past.length ? Math.round((d.withSetlist.length / d.past.length) * 100) : 0;
  const most = d.mostPlayed.map(p => ({ ...p, n: p.dates.length }));
  const span = (p: Play) => {
    const a = year(p.dates[0]), b = year(p.dates[p.dates.length - 1]);
    return a === b ? a : s.dataSpan.replace('{first}', a).replace('{last}', b);
  };
  const gapText = (dd: number) => dd >= 365 ? s.dataYearsN.replace('{n}', (Math.round((dd / 365.25) * 10) / 10).toString()) : s.dataMonthsN.replace('{n}', String(Math.max(1, Math.round(dd / 30.4))));
  const name = (p: { title: string; song?: Song }) => <SongName p={p} prefix={prefix} locale={locale} />;

  return (
    <div className="lu-data-page" style={{ '--data-ink': accent } as CSSProperties}>
      <div className="lu-page-head">
        <div>
          {/* Tap the title for another colour */}
          <h1 className="lu-data-h1" onClick={() => setAccent(a => pickAccent(a))}>{s.dataTitle}</h1>
          <p className="lu-hint"><Icon name="lock" /> {s.dataLead}</p>
        </div>
      </div>

      <ul className="lu-data-tiles">
        <Tile n={d.past.length} label={s.dataShows} sub={d.firstYear && s.dataSpan.replace('{first}', d.firstYear).replace('{last}', d.lastYear)} />
        <Tile n={d.withSetlist.length} label={s.dataWithSetlist} sub={`${pct}%`} />
        <Tile n={d.plays.length} label={s.dataSongsLive} />
        <Tile n={d.performances} label={s.dataPerformances} />
        <Tile n={new Set(d.past.map(e => e.venue_id || e.venue_ja)).size} label={s.dataVenues} />
      </ul>
      <p className="lu-hint lu-data-coverage">{s.dataCoverage.replace('{n}', String(d.withSetlist.length)).replace('{total}', String(d.past.length))}</p>

      <Section title={s.dataPerYear}>
        <YearColumns data={d.perYear} s={s} />
      </Section>

      {d.plays.length === 0 ? <p className="lu-empty">{s.dataEmpty}</p> : (
        <div className="lu-data-grid">
          <div className="lu-data-col-stack">
            <Section title={s.dataMostPlayed}>
              <p className="lu-hint">{s.dataMostPlayedHint}</p>
              <Ranked s={s} rows={allMost ? most : most.slice(0, MOST_SHOWN)} name={name} sub={span} />
              {most.length > MOST_SHOWN && (
                <button type="button" className="lu-link-btn lu-act-toggle" onClick={() => setAllMost(a => !a)}>
                  {allMost ? s.lyricsLess : s.dataShowAll.replace('{n}', String(most.length))}
                </button>
              )}
            </Section>
            <Section title={s.dataByYear}>
              <p className="lu-hint">{s.dataByYearHint}</p>
              <ul className="lu-data-years">
                {(allYears ? d.byYear : d.byYear.slice(0, YEARS_SHOWN)).map(y => (
                  <li key={y.year}>
                    <span className="lu-data-year"><strong>{y.year}</strong><small>{s.dataSetlistsShort.replace('{n}', String(y.setlists))}</small></span>
                    <ol>
                      {y.top.map(p => <li key={p.key}>{name(p)} <span className="lu-data-times">{s.dataTimes.replace('{n}', String(p.n))}</span></li>)}
                    </ol>
                  </li>
                ))}
              </ul>
              {d.byYear.length > YEARS_SHOWN && (
                <button type="button" className="lu-link-btn lu-act-toggle" onClick={() => setAllYears(a => !a)}>
                  {allYears ? s.lyricsLess : s.dataAllYears.replace('{n}', String(d.byYear.length))}
                </button>
              )}
            </Section>
            <Section title={s.dataDebuts}>
              <p className="lu-hint">{s.dataDebutsHint}</p>
              <ul className="lu-data-years">
                {(allDebuts ? d.debuts : d.debuts.slice(0, YEARS_SHOWN)).map(y => (
                  <li key={y.year}>
                    <span className="lu-data-year"><strong>{y.year}</strong><small>{y.songs.length}</small></span>
                    <p className="lu-data-chips">{y.songs.map(p => <span key={p.key} className="lu-data-chip">{name(p)}</span>)}</p>
                  </li>
                ))}
              </ul>
              {d.debuts.length > YEARS_SHOWN && (
                <button type="button" className="lu-link-btn lu-act-toggle" onClick={() => setAllDebuts(a => !a)}>
                  {allDebuts ? s.lyricsLess : s.dataAllYears.replace('{n}', String(d.debuts.length))}
                </button>
              )}
            </Section>
            {d.neverLive.length > 0 && (
              <Section title={`${s.dataNeverLive} · ${d.neverLive.length}`}>
                <p className="lu-hint">{s.dataNeverLiveHint}</p>
                <p className="lu-data-chips">
                  {d.neverLive.map(x => (
                    <span key={x.id} className="lu-data-chip">
                      <Link to={`${prefix}/songs/${x.id}`}>{songTitle(x, locale)}</Link>
                      {x.status === 'private' && <Icon name="lock" />}
                    </span>
                  ))}
                </p>
              </Section>
            )}
          </div>
          <div className="lu-data-col-stack">
            <Section title={s.dataOpeners}><Ranked s={s} rows={d.openers} name={name} /></Section>
            {d.closers.length > 0 && <Section title={s.dataClosers}><p className="lu-hint">{s.dataClosersHint}</p><Ranked s={s} rows={d.closers} name={name} /></Section>}
            {d.encores.length > 0 && <Section title={s.dataEncores}><Ranked s={s} rows={d.encores} name={name} /></Section>}
            <Section title={s.dataTopVenues}>
              <Ranked s={s} rows={d.venues} name={v => v.id ? <Link to={`${prefix}/venues/${v.id}`}>{v.name}</Link> : v.name} />
            </Section>
            <Section title={s.dataGaps}>
              <p className="lu-hint">{s.dataGapsHint}</p>
              <ul className="lu-data-list">
                {d.gaps.map(p => (
                  <li key={p.key}>
                    <span className="lu-data-list-name">{name(p)}</span>
                    <span className="lu-data-list-v"><strong>{gapText(p.gap.d)}</strong><small>{dot(p.gap.from)} → {dot(p.gap.to)}</small></span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title={s.dataNotLately}>
              <p className="lu-hint">{s.dataNotLatelyHint}</p>
              <ul className="lu-data-list">
                {d.notLately.map(p => (
                  <li key={p.key}>
                    <span className="lu-data-list-name">{name(p)}</span>
                    <span className="lu-data-list-v"><strong>{s.dataLastPlayed.replace('{date}', dot(p.dates[p.dates.length - 1]))}</strong><small>{s.dataTimes.replace('{n}', String(p.dates.length))}</small></span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

