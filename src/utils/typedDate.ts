/**
 * A date typed any common way → "YYYY-MM-DD", or null:
 * 2008-09-21, 2008/9/21, 2008.9.21, 20080921, 2008年9月21日 (full-width digits too).
 */
export function typedDate(text: string): string | null {
  const t = (text || '').normalize('NFKC').trim();
  const m = t.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/) || t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
