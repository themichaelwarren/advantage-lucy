/**
 * Ticket prices, typed any way: "2000", "2,000", "¥2,000", "￥２０００",
 * "2000円", "2,000 yen", "¥2,000 (+1 drink)". All read as the same amount
 * and show the same: "¥2,000" (and the note after it, if any). "0", "無料"
 * and "free" are free. Anything that doesn't start with an amount
 * ("前売 2000 / 当日 2500", "TBA") is shown as typed.
 * Shared by the site (src/utils/format.ts) and the reservation emails.
 */
export interface Price { amount: number | null; rest: string; free: boolean }

const AMOUNT = /^(?:[¥$£₩€]|nt\$|ca\$|a\$|jpy|usd)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:円|yen|jpy)?(?![\d,])\s*(.*)$/i;

export function readPrice(raw: string): Price {
  const t = (raw || '').normalize('NFKC').trim();
  if (/^(?:0+|無料|free|フリー|入場無料)$/i.test(t)) return { amount: 0, rest: '', free: true };
  const m = t.match(AMOUNT);
  if (!m) return { amount: null, rest: t, free: false };
  const amount = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return { amount: null, rest: t, free: false };
  return { amount, rest: m[2].trim(), free: amount === 0 && !m[2].trim() };
}

/** "¥2,000", "¥2,000 (+1 drink)", the free label, or the text as typed. */
export function showPrice(raw: string, symbol = '¥', freeLabel = 'FREE'): string {
  const p = readPrice(raw);
  if (p.free) return freeLabel;
  if (p.amount === null) return p.rest;
  return `${symbol}${p.amount.toLocaleString('en')}${p.rest ? ` ${p.rest}` : ''}`;
}
