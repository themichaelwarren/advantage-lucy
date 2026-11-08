/** Today's date in Japan (YYYY-MM-DD): the band plays in Japan, so "is the show over?" is decided in JST. */
export function todayInJapan(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

/**
 * A setlist goes public the day after the show's last day (Japan time), so
 * the band can enter it beforehand without spoiling it.
 */
export function setlistIsPublic(show: { date: string; end_date?: string }, today = todayInJapan()): boolean {
  return (show.end_date || show.date) < today;
}
