import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAreas, useCountries, usePrefectures } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import type { AdminLocale } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

/**
 * Places: Areas | Prefectures | Countries, as tabs on one admin page.
 * Areas live in AdminAreas*; this file has the tab bar plus the
 * Prefectures and Countries lists and edit pages.
 */

type Named = { id: string; name_en: string; name_ja: string };
const nameIn = (x: Named, locale: AdminLocale) => (locale === 'ja' ? x.name_ja || x.name_en : x.name_en || x.name_ja) || x.id;
const otherName = (x: Named, locale: AdminLocale) => (locale === 'ja' ? x.name_en : x.name_ja);

export function PlacesTabs() {
  const { s, prefix } = useAdminT();
  return (
    <nav className="lu-chips lu-places-tabs" aria-label={s.areas}>
      <NavLink to={`${prefix}/areas`} className={({ isActive }) => `lu-pill${isActive ? ' is-on' : ''}`}>{s.areas}</NavLink>
      <NavLink to={`${prefix}/prefectures`} className={({ isActive }) => `lu-pill${isActive ? ' is-on' : ''}`}>{s.prefectures}</NavLink>
      <NavLink to={`${prefix}/countries`} className={({ isActive }) => `lu-pill${isActive ? ' is-on' : ''}`}>{s.countries}</NavLink>
    </nav>
  );
}

/* ---------------- lists ---------------- */

function PlaceList<T extends Named>({ kind, items, loading, count, countLabel, sub }: {
  kind: 'prefectures' | 'countries';
  items: T[];
  loading: boolean;
  count: (x: T) => number;
  countLabel: string;          // e.g. '{n} areas'
  sub?: (x: T) => string;
}) {
  const { s, locale, prefix } = useAdminT();
  const ui = useListPrefs<'all' | 'unused', 'count' | 'az'>(kind, { filter: 'all', sort: 'count' });
  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return items
      .filter(x => !q || [x.name_en, x.name_ja, x.id].some(t => t?.toLowerCase().includes(q)))
      .filter(x => ui.filter === 'all' || !count(x))
      .sort((a, b) => ui.sort === 'az'
        ? nameIn(a, locale).localeCompare(nameIn(b, locale), locale)
        : count(b) - count(a) || nameIn(a, locale).localeCompare(nameIn(b, locale), locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ui.query, ui.filter, ui.sort, locale, count]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;
  const isPref = kind === 'prefectures';

  return (
    <>
      <div className="lu-page-head">
        <div>
          <h1>{isPref ? s.prefectures : s.countries} <span className="lu-count">{items.length}</span></h1>
          <p className="lu-hint">{s.placesHint}</p>
        </div>
        <Link to={`${prefix}/${kind}/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {isPref ? s.addPrefecture : s.addCountry}</Link>
      </div>
      <PlacesTabs />
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'unused', label: s.filterUnused }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as 'all' | 'unused')}
        sorts={[{ value: 'count', label: isPref ? s.areas : s.prefectures }, { value: 'az', label: s.sortAZ }]}
        sort={ui.sort} onSort={v => ui.setSort(v as 'count' | 'az')}
        shown={list.length} total={items.length}
      />
      <ul className="lu-list">
        {list.map(x => {
          const other = otherName(x, locale);
          return (
            <li key={x.id}>
              <Link to={`${prefix}/${kind}/${x.id}`} className="lu-list-row">
                <span className="lu-list-main">
                  <strong>{nameIn(x, locale)}</strong>
                  <span>{[other && other !== nameIn(x, locale) ? other : '', sub?.(x) || ''].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="lu-list-tags"><span className="lu-tag">{countLabel.replace('{n}', String(count(x)))}</span></span>
              </Link>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="lu-empty">{s.noResults}</p>}
    </>
  );
}

export function AdminPrefectures() {
  const { s, locale } = useAdminT();
  const { prefectures, loading } = usePrefectures();
  const { areas } = useAreas();
  const { countries } = useCountries();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    areas.forEach(a => a.prefecture && m.set(a.prefecture, (m.get(a.prefecture) || 0) + 1));
    return m;
  }, [areas]);
  const countryName = useMemo(() => new Map(countries.map(c => [c.id, nameIn(c, locale)])), [countries, locale]);
  const count = useMemo(() => (p: Named) => counts.get(p.id) || 0, [counts]);
  return (
    <PlaceList
      kind="prefectures" items={prefectures} loading={loading}
      count={count} countLabel={s.areasCountN}
      sub={p => countryName.get((p as typeof prefectures[number]).country) || ''}
    />
  );
}

export function AdminCountries() {
  const { s } = useAdminT();
  const { countries, loading } = useCountries();
  const { prefectures } = usePrefectures();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    prefectures.forEach(p => p.country && m.set(p.country, (m.get(p.country) || 0) + 1));
    return m;
  }, [prefectures]);
  const count = useMemo(() => (c: Named) => counts.get(c.id) || 0, [counts]);
  return <PlaceList kind="countries" items={countries} loading={loading} count={count} countLabel={s.prefecturesCountN} />;
}

/* ---------------- edit pages ---------------- */

function PlaceForm({ kind }: { kind: 'prefectures' | 'countries' }) {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const isPref = kind === 'prefectures';
  const tab = isPref ? 'Prefectures' : 'Countries';

  const { prefectures, loading: prefLoading } = usePrefectures();
  const { countries, loading: countryLoading } = useCountries();
  const { areas } = useAreas();
  const items: Named[] = isPref ? prefectures : countries;
  const loading = isPref ? prefLoading : countryLoading;

  const empty = { id: '', name_en: '', name_ja: '', country: isPref ? 'jp' : '' };
  const [form, setForm] = useState(empty);
  const [baseline, setBaseline] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(empty)); return; }
    if (loading) return;
    const x = (isPref ? prefectures : countries).find(r => r.id === id) as (Named & { country?: string }) | undefined;
    if (!x) return;
    const f = { id: x.id, name_en: x.name_en || '', name_ja: x.name_ja || '', country: x.country || '' };
    setForm(f);
    setBaseline(JSON.stringify(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, prefectures, countries]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };

  // What's inside: areas in a prefecture, prefectures in a country
  const children = useMemo(() => (isPref
    ? areas.filter(a => form.id && a.prefecture === form.id).map(a => ({ id: a.id, name: nameIn(a, locale), href: `${prefix}/areas/${a.id}` }))
    : prefectures.filter(p => form.id && p.country === form.id).map(p => ({ id: p.id, name: nameIn(p, locale), href: `${prefix}/prefectures/${p.id}` }))
  ).sort((a, b) => a.name.localeCompare(b.name, locale)), [isPref, areas, prefectures, form.id, locale, prefix]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name_en.trim() && !form.name_ja.trim()) { setNameError(s.areaNameMissing); return; }
    setSaving(true);
    setError('');
    try {
      const en = form.name_en.trim();
      const newId = makeId([en && /^[\x20-\x7e]+$/.test(en) ? en : `${isPref ? 'pref' : 'country'}-${Date.now().toString(36)}`], new Set(items.map(x => x.id)));
      const placeId = isNew ? newId : form.id;
      const base = { id: placeId, name_en: form.name_en.trim(), name_ja: form.name_ja.trim() };
      const fields: Record<string, string> = isPref ? { ...base, country: form.country } : base;
      if (isNew) await createRow(tab, fields);
      else await updateRow(tab, placeId, fields);
      const next = { ...form, ...base };
      setForm(next);
      setBaseline(JSON.stringify(next));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/${kind}/${placeId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const heading = isNew ? (isPref ? s.newPrefecture : s.newCountry) : nameIn(form, locale);

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? (isPref ? s.prefectures : s.countries) : (isPref ? s.editPrefecture : s.editCountry)}</p>
          <h1>{heading}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <BilingualRow>
          <Field label={`${s.placeName} · ${s.english}`} error={nameError}>
            {fid => <input id={fid} value={form.name_en} onChange={e => set('name_en', e.target.value)} />}
          </Field>
          <Field label={`${s.placeName} · ${s.japanese}`}>
            {fid => <input id={fid} lang="ja" value={form.name_ja} onChange={e => set('name_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        {isPref && (
          <Field label={s.country} optional s={s}>
            {fid => (
              <select id={fid} value={form.country} onChange={e => set('country', e.target.value)}>
                <option value="">{s.prefectureNone}</option>
                {countries.map(c => <option key={c.id} value={c.id}>{nameIn(c, locale)}</option>)}
              </select>
            )}
          </Field>
        )}
        {isPref && form.country && countries.some(c => c.id === form.country) && (
          <Link to={`${prefix}/countries/${form.country}`} className="lu-related-link">{nameIn(countries.find(c => c.id === form.country)!, locale)} →</Link>
        )}
      </Section>

      {!isNew && (
        <Section title={`${isPref ? s.areasHere : s.prefecturesHere} · ${children.length}`}>
          {children.length === 0 ? <p className="lu-hint">{s.noneHere}</p> : (
            <ul className="lu-list lu-usage">
              {children.map(c => (
                <li key={c.id}><Link to={c.href} className="lu-list-row"><span className="lu-list-main"><strong>{c.name}</strong></span></Link></li>
              ))}
            </ul>
          )}
          <div className="lu-danger-row">
            {children.length > 0
              ? <p className="lu-hint">{s.inUseCantDelete}</p>
              : <DeleteButton s={s} onConfirm={async () => {
                  try { await deleteRow(tab, form.id); navigate(`${prefix}/${kind}`); }
                  catch (err) { setError(errorText(err)); }
                }} />}
          </div>
        </Section>
      )}

      <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/${kind}`} />
    </form>
  );
}

export const AdminPrefectureForm = () => <PlaceForm kind="prefectures" />;
export const AdminCountryForm = () => <PlaceForm kind="countries" />;
