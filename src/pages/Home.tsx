import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents } from '../hooks/useSheetData';
import EventCard from '../components/EventCard';

const GREETINGS = [
  'hi',
  'hey',
  'hey there',
  'hello',
  'hello again',
  'hello mate!',
];

interface Props {
  locale: Locale;
}

export default function Home({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { events, loading: eventsLoading } = useEvents();
  const now = new Date().toISOString().slice(0, 10);

  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const upcoming = events
    .filter(e => e.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextShow = upcoming[0];
  const recentPast = events
    .filter(e => e.date < now)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (eventsLoading) return null;

  return (
    <>
      {/* Hero */}
      <div className="page-title home-hero">
        <h1><span>{greeting}</span></h1>
        <p className="home-subtitle">this is advantagelucy.com</p>
      </div>

      {/* Next show */}
      {nextShow && (
        <section className="mb-2">
          <h2 className="section-label">{s.home.nextShow}</h2>
          <EventCard event={nextShow} locale={locale} featured />
        </section>
      )}

      {/* Recent events */}
      {recentPast.length > 0 && (
        <section className="mb-2">
          <h2 className="section-label">{s.home.recentEvents}</h2>
          {recentPast.map(event => (
            <EventCard key={event.id} event={event} locale={locale} />
          ))}
          <div className="text-center mt-1">
            <Link to={`${prefix}/events`} className="tag">
              <span>{s.home.viewAllEvents}</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      )}

    </>
  );
}
