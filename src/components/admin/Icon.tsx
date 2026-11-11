import {
  House, Mail, Ticket, CalendarDays, Newspaper, Camera, Image, Disc3, Music, Clapperboard, Users, MapPin, Map as MapIcon,
  SquarePen, Lock, TriangleAlert, ClipboardPaste, Paperclip, X, Check, ChevronUp, ChevronDown, ArrowUpRight,
  ArrowLeft, Play, List, LayoutGrid, Table2, Sparkles, ListMusic, Plus, DoorOpen, Star, CircleHelp, Link2, Clock, FileText, type LucideIcon,
} from 'lucide-react';

/**
 * The admin's icons, one consistent line set (Lucide). Use names, not the
 * icon components, so changing how something looks is a one-line change
 * here (e.g. a different "edit" icon everywhere).
 */
const ICONS = {
  // Menu
  home: House, messages: Mail, reservations: Ticket, shows: CalendarDays, news: Newspaper, blog: Camera,
  photos: Image, releases: Disc3, songs: Music, videos: Clapperboard, people: Users, venues: MapPin, areas: MapIcon,
  // Actions and markers
  edit: SquarePen, lock: Lock, warn: TriangleAlert, paste: ClipboardPaste, attach: Paperclip, mail: Mail,
  close: X, check: Check, up: ChevronUp, down: ChevronDown, external: ArrowUpRight, back: ArrowLeft, play: Play,
  list: List, grid: LayoutGrid, table: Table2, new: Sparkles, setlist: ListMusic, ticket: Ticket, image: Image,
  add: Plus, door: DoorOpen, star: Star, help: CircleHelp, link: Link2, clock: Clock, doc: FileText,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export default function Icon({ name, className = '', size }: { name: IconName; className?: string; size?: number | string }) {
  const C = ICONS[name];
  return <C className={`lu-ic ${className}`.trim()} aria-hidden="true" focusable="false" strokeWidth={2} {...(size ? { size } : {})} />;
}
