/**
 * Musical keys: 12 notes, major or minor (24 keys), in the spellings
 * usually written for each key (B♭ major, but C♯ minor; F♯ either way).
 * Shared by the admin picker and the server's check.
 */
export const NOTES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
/** Minor keys, by the same 12 positions */
export const MINOR_NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'] as const;

/** "G", "Em", "B♭", "F♯m" … all 24 */
export const KEYS: string[] = [
  ...NOTES.map(n => n),
  ...MINOR_NOTES.map(n => `${n}m`),
];

/** Position 0–11 and minor-or-not of a key like "F♯m", or null. */
export function parseKey(key: string): { pos: number; minor: boolean } | null {
  const minor = key.endsWith('m');
  const note = minor ? key.slice(0, -1) : key;
  const pos = (minor ? MINOR_NOTES : NOTES).indexOf(note as never);
  return pos === -1 ? null : { pos, minor };
}

export const keyName = (pos: number, minor: boolean) => (minor ? `${MINOR_NOTES[pos]}m` : NOTES[pos]);
