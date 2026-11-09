import type { Prefecture } from '../../types';
import type { AdminLocale } from '../../i18n/admin';
import { createRow } from '../../services/adminService';
import { makeId } from './ui';
import { normalize } from './SuggestInput';
import type { Suggestion } from './SuggestInput';

/**
 * All 47 Japanese prefectures, so picking one never means "add it first".
 * Ones the sheet doesn't have yet are created on save (country "jp").
 * IDs match the ones already in the sheet (tokyo, osaka, …).
 */
export const JP_PREFECTURES: { id: string; name_en: string; name_ja: string }[] = [
  ['hokkaido', 'Hokkaido', '北海道'], ['aomori', 'Aomori', '青森県'], ['iwate', 'Iwate', '岩手県'],
  ['miyagi', 'Miyagi', '宮城県'], ['akita', 'Akita', '秋田県'], ['yamagata', 'Yamagata', '山形県'],
  ['fukushima', 'Fukushima', '福島県'], ['ibaraki', 'Ibaraki', '茨城県'], ['tochigi', 'Tochigi', '栃木県'],
  ['gunma', 'Gunma', '群馬県'], ['saitama', 'Saitama', '埼玉県'], ['chiba', 'Chiba', '千葉県'],
  ['tokyo', 'Tokyo', '東京都'], ['kanagawa', 'Kanagawa', '神奈川県'], ['niigata', 'Niigata', '新潟県'],
  ['toyama', 'Toyama', '富山県'], ['ishikawa', 'Ishikawa', '石川県'], ['fukui', 'Fukui', '福井県'],
  ['yamanashi', 'Yamanashi', '山梨県'], ['nagano', 'Nagano', '長野県'], ['gifu', 'Gifu', '岐阜県'],
  ['shizuoka', 'Shizuoka', '静岡県'], ['aichi', 'Aichi', '愛知県'], ['mie', 'Mie', '三重県'],
  ['shiga', 'Shiga', '滋賀県'], ['kyoto', 'Kyoto', '京都府'], ['osaka', 'Osaka', '大阪府'],
  ['hyogo', 'Hyogo', '兵庫県'], ['nara', 'Nara', '奈良県'], ['wakayama', 'Wakayama', '和歌山県'],
  ['tottori', 'Tottori', '鳥取県'], ['shimane', 'Shimane', '島根県'], ['okayama', 'Okayama', '岡山県'],
  ['hiroshima', 'Hiroshima', '広島県'], ['yamaguchi', 'Yamaguchi', '山口県'], ['tokushima', 'Tokushima', '徳島県'],
  ['kagawa', 'Kagawa', '香川県'], ['ehime', 'Ehime', '愛媛県'], ['kochi', 'Kochi', '高知県'],
  ['fukuoka', 'Fukuoka', '福岡県'], ['saga', 'Saga', '佐賀県'], ['nagasaki', 'Nagasaki', '長崎県'],
  ['kumamoto', 'Kumamoto', '熊本県'], ['oita', 'Oita', '大分県'], ['miyazaki', 'Miyazaki', '宮崎県'],
  ['kagoshima', 'Kagoshima', '鹿児島県'], ['okinawa', 'Okinawa', '沖縄県'],
].map(([id, name_en, name_ja]) => ({ id, name_en, name_ja }));

const pick = (locale: AdminLocale, en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';

/** What a typed prefecture can match: its ID, either name, or the Japanese name without 都/道/府/県 ("東京"). */
const keysOf = (p: { id: string; name_en?: string; name_ja?: string }) =>
  [p.id, p.name_en, p.name_ja, p.name_ja?.replace(/[都道府県]$/, '')].filter(Boolean).map(x => normalize(x!));

/** The sheet's prefectures, then any Japanese ones it doesn't have yet. */
export function prefectureSuggestions(prefectures: Prefecture[], locale: AdminLocale, countryName: (id: string) => string): Suggestion[] {
  const have = new Set(prefectures.flatMap(keysOf));
  const fromSheet = prefectures.map(p => ({
    value: pick(locale, p.name_en, p.name_ja) || p.id,
    hint: [locale === 'ja' ? p.name_en : p.name_ja, countryName(p.country)].filter(Boolean).join(' · ') || undefined,
    keywords: p.id,
  }));
  const builtIn = JP_PREFECTURES
    .filter(p => !keysOf(p).some(k => have.has(k)))
    .map(p => ({ value: pick(locale, p.name_en, p.name_ja), hint: `${locale === 'ja' ? p.name_en : p.name_ja} · ${countryName('jp') || 'Japan'}`, keywords: p.id }));
  return [...fromSheet, ...builtIn].sort((a, b) => a.value.localeCompare(b.value, locale));
}

/** Display name of a prefecture ID (for the text box). */
export function prefectureName(id: string, prefectures: Prefecture[], locale: AdminLocale): string {
  const p = prefectures.find(x => x.id === id) || JP_PREFECTURES.find(x => x.id === id);
  return p ? pick(locale, p.name_en, p.name_ja) || p.id : id;
}

/**
 * The prefecture for what was typed: one already in the sheet, else a
 * Japanese one from the built-in list (added to the sheet), else a new one
 * (added with no country; set it on the prefecture's page). '' for blank.
 */
export async function resolvePrefecture(typed: string, prefectures: Prefecture[]): Promise<string> {
  const key = normalize(typed.trim());
  if (!key) return '';
  const found = prefectures.find(p => keysOf(p).includes(key));
  if (found) return found.id;
  const jp = JP_PREFECTURES.find(p => keysOf(p).includes(key));
  const taken = new Set(prefectures.map(p => p.id));
  if (jp) {
    const id = taken.has(jp.id) ? makeId([jp.id], taken) : jp.id;
    await createRow('Prefectures', { id, name_en: jp.name_en, name_ja: jp.name_ja, country: 'jp' });
    return id;
  }
  const t = typed.trim();
  const ascii = /^[\x20-\x7e]+$/.test(t);
  const id = makeId([ascii ? t : `pref-${Date.now().toString(36)}`], taken);
  await createRow('Prefectures', { id, name_en: ascii ? t : '', name_ja: ascii ? '' : t, country: '' });
  return id;
}
