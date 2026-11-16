import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAdminT } from '../../i18n/admin';
import { helpSection } from '../../pages/admin/AdminHelp';
import Icon from './Icon';

/**
 * A "?" beside a page title. It opens three short tips for this page, with
 * a link to the Help page at that page's section for everything else.
 *
 * Which part is picked from the address: /admin/events/… → Shows.
 */
const SECTION_FOR: Record<string, string> = {
  '': 'basics', events: 'shows', reservations: 'reservations', messages: 'messages',
  news: 'posts', blog: 'posts', photos: 'posts',
  releases: 'releases', songs: 'songs', videos: 'videos', people: 'people',
  venues: 'places', areas: 'places', prefectures: 'places', countries: 'places',
  data: 'data', activity: 'history',
};

/** The three things worth knowing on each page. The rest is on the Help page (the link at the bottom). */
type Tips = { en: string[]; ja: string[] };
const TIPS: Record<string, Tips> = {
  '': {
    en: ['“What’s missing” lists shows without a setlist, videos without a show, possible duplicates and broken links.', `Search (⌘K / Ctrl K) finds anything, and has shortcuts like “Add show”. Type a date to jump to that show, or add one.`, 'Everything you save goes into the band’s Google Sheet and is on the site straight away.'],
    ja: ['「足りないもの」に、セトリのないライブ、ライブ未定の動画、重複かもしれないもの、切れたリンクが並びます。', '検索（⌘K / Ctrl K）で何でも探せます。「ライブを追加」などのショートカットも。日付を打つとそのライブへ（なければ追加）。', '保存したものはバンドのGoogleスプレッドシートに入り、すぐサイトに反映されます。'],
  },
  events: {
    en: ['Date and venue are enough to add a show. Leave the title blank for a regular gig.', 'A setlist goes public the day after the show, so it can be filled in on the night.', 'Found a setlist online or in a video’s description? “Paste a setlist” in the setlist editor.'],
    ja: ['ライブの追加は日付と会場だけでOK。普通のライブならタイトルは空欄で。', 'セトリは公演の翌日に公開されるので、当日の夜に入れても大丈夫です。', 'ネットや動画の説明欄でセトリを見つけたら、セトリ編集の「セットリストを貼り付け」へ。'],
  },
  reservations: {
    en: ['Turn bookings on in a show’s Tickets section. Fans get a confirmation email by themselves.', 'Tap a booking to edit or cancel it. “Add a reservation” is for bookings by DM or phone.', 'Door mode on the night: open it on a phone and tap names as people arrive.'],
    ja: ['ライブの「チケット」欄でオンにします。確認メールは自動で届きます。', '予約をタップで編集・キャンセル。DMや電話の予約は「予約を追加」から。', '当日は受付モードで。スマホで開いて、来た人の名前をタップします。'],
  },
  messages: {
    en: ['Messages from the site’s contact form, also emailed to the band.', 'Reply opens your email app. Then “Mark as done” so it leaves the New count.', '“Filter this sender” keeps someone’s messages out of the inbox and the band’s email.'],
    ja: ['サイトのお問い合わせフォームからのメッセージです。バンドにもメールで届きます。', '「返信」でメールアプリが開きます。返したら「対応済みにする」を。', '「この送信者をフィルター」で、その人のメッセージを受信一覧とメールから外せます。'],
  },
  news: {
    en: ['A title and text in each language, an optional image, and when it goes live.', 'A blank line starts a new paragraph. Select words for Link or Bold.', 'Fill in whichever language you can: the site shows the other one when one is missing.'],
    ja: ['タイトルと本文（日英）、画像（任意）、公開日時を入れます。', '空行で段落が変わります。文字を選ぶとリンクや太字に。', '書けるほうの言語だけでもOK。ない方はもう一方の言語で表示されます。'],
  },
  blog: {
    en: ['Blog posts are Instagram posts: on Instagram tap ⋯ → Copy link, and paste it here.', 'The home page shows the latest four by itself.', 'To take a post off the site without deleting it, make it Hidden.'],
    ja: ['ブログはInstagramの投稿です。Instagramで ⋯ →「リンクをコピー」して貼り付けます。', 'ホームには最新の4件が自動で並びます。', '削除せずにサイトから外すときは「非公開」に。'],
  },
  photos: {
    en: ['Photos rotate on the home page in this order. Drag to reorder (‹ › on a phone).', 'A photo can link to a show or any page. A show’s flyer leaves the home page once the show is over.', '“Link preview” picks the picture shown when someone shares the site.'],
    ja: ['ホームの写真はこの順番で切り替わります。ドラッグで並べ替え（スマホは ‹ ›）。', '写真からライブや任意のページにリンクできます。ライブのフライヤーは終演後に自動でホームから外れます。', '「プレビュー画像」で、サイトがシェアされたときの画像を選べます。'],
  },
  songs: {
    en: ['Click a heading to sort, and combine the filters (no lyrics, no key, never played…).', 'A song’s reading puts Japanese pages in 五十音 order; its English title is what fans abroad know it by.', 'Draft songs have no page on the site, but still show in setlists.'],
    ja: ['見出しをクリックで並べ替え。絞り込み（歌詞なし・キーなし・未演奏…）は組み合わせられます。', '読みで日本語ページが五十音順に。英語タイトルは海外のファン向けの表記です。', '下書きの曲はサイトにページがありませんが、セトリには表示されます。'],
  },
  releases: {
    en: ['The table view shows what’s missing: cover, tracks, notes, link (dashed = missing).', 'The tracklist is edited right on the release’s page.', 'Listen links: paste one in any box and it moves to the right service.'],
    ja: ['表で見ると足りないもの（ジャケット・曲目・解説・リンク）がわかります（点線＝未入力）。', '曲目はリリースのページで直接編集します。', '配信リンクはどの欄に貼っても、正しいサービスに移ります。'],
  },
  videos: {
    en: ['“+ Add a video” walks you through it: paste the link, pick the show or song, tick the songs.', 'Not sure which show? Choose that, and connect it later.', 'Videos are band only. Ones that stop playing are marked Deleted or Private.'],
    ja: ['「＋動画を追加」で順番に案内します：リンクを貼り、ライブか曲を選び、曲にチェック。', 'どのライブかわからないときはそれを選んで、あとでつなげます。', '動画はバンドだけが見られます。見られなくなったものには「削除」「非公開」の印が付きます。'],
  },
  people: {
    en: ['People are who wrote the songs: the names in music and lyrics credits.', 'Names go in English and Japanese, family and given name separately.', 'Credits are picked on a song’s page. Add someone new here first.'],
    ja: ['人物は曲を書いた人です（作曲・作詞のクレジット）。', '名前は英語と日本語、姓と名を分けて入れます。', 'クレジットは曲のページで選びます。新しい人は先にここで追加を。'],
  },
  venues: {
    en: ['A venue’s page has its map, every show there, and the songs played there most.', 'Renamed venue? Keep one venue and add the old names under Former names (✎).', 'In twice? Open one, ✎, “Merge into…”.'],
    ja: ['会場のページに地図、そこでのライブ、よく演奏した曲が並びます。', '名前が変わった会場は1つのまま、✎ の「以前の名前」に旧名を追加します。', '二重に入っていたら、片方を開いて ✎ →「まとめる…」。'],
  },
  areas: {
    en: ['Venues sit in areas (like Shimokitazawa), areas in prefectures, prefectures in countries.', 'Names go in English and Japanese; searching the Shows page works in either, and in kana.', 'Anything still in use can’t be deleted.'],
    ja: ['会場はエリア（下北沢など）に、エリアは都道府県に、都道府県は国に入ります。', '名前は日英で。ライブページの検索はどちらでも、かなでも探せます。', '使われているものは削除できません。'],
  },
  data: {
    en: ['The archive in numbers: shows per year, most played songs, openers, closers, debuts and more.', 'Counts come from the setlists, so they get truer as more are filled in.', 'Tap a year in the chart for its numbers. Only the band sees this page.'],
    ja: ['アーカイブを数字で：年ごとのライブ数、よく演奏した曲、1曲目・最後の曲、初披露など。', '数字はセトリから出しているので、セトリが増えるほど正確になります。', 'グラフの年をタップで詳細に。このページはバンドだけが見られます。'],
  },
  activity: {
    en: ['Every save is recorded: who, when, and what changed.', 'Filter by kind or by person.', 'Each page also has its own History at the bottom.'],
    ja: ['保存はすべて記録されます：だれが、いつ、何を変えたか。', '種類や人で絞り込めます。', '各ページのいちばん下にも、そのページの「履歴」があります。'],
  },
};
TIPS.prefectures = TIPS.countries = TIPS.areas;

export default function PageHelp() {
  const { locale, prefix } = useAdminT();
  const { pathname } = useLocation();
  const page = pathname.split('/admin')[1]?.split('/')[1] || '';
  const sec = helpSection(locale, SECTION_FOR[page] || '');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Closes on another page, Esc, or a tap outside
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(360,window.innerWidth - 32);
      const top = r.bottom + 8;
      setPos({ top, left: Math.max(16, Math.min(r.left - 12, window.innerWidth - width - 16)), maxHeight: window.innerHeight - top - 16 });
    };
    place();
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  useLayoutEffect(() => { if (open && pos) panel.current?.focus({ preventScroll: true }); }, [open, !!pos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sec) return null;
  const label = locale === 'ja' ? `ヘルプ：${sec.title}` : `Help: ${sec.title}`;
  return (
    <>
      <button
        ref={btn} type="button" className={`lu-pagehelp-btn${open ? ' is-open' : ''}`}
        aria-label={label} aria-expanded={open} title={label}
        // The data page's title changes colour when clicked; the ? shouldn't
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <Icon name="help" />
      </button>
      {open && pos && createPortal(
        <div ref={panel} className="lu-pagehelp" role="dialog" aria-label={label} tabIndex={-1}
          style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}>
          <p className="lu-pagehelp-title"><Icon name={sec.icon} /> {sec.title}</p>
          <ul>{(TIPS[page]?.[locale === 'ja' ? 'ja' : 'en'] || sec.points.slice(0, 3)).map((p, i) => <li key={i}>{p}</li>)}</ul>
          <Link to={`${prefix}/help/${sec.id}`} className="lu-pagehelp-more">
            {locale === 'ja' ? 'くわしくはヘルプページへ →' : 'More on the Help page →'}
          </Link>
        </div>,
        document.body,
      )}
    </>
  );
}
