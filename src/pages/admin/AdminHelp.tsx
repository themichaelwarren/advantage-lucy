import { Link } from 'react-router-dom';
import { useAdminT } from '../../i18n/admin';

/**
 * Help: how the admin works, on one page. Written for the band, not for
 * developers. Each section is a short list; add to it as questions come up.
 *
 * The text lives here rather than in i18n/admin.ts because it's long prose
 * that's easier to edit side by side. Keep the English and Japanese sections
 * in the same order with the same ids.
 */

type Section = {
  id: string;
  icon: string;
  title: string;
  /** Admin page this section is about (path after /:locale/admin) */
  link?: { to: string; label: string };
  points: string[];
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const searchKey = isMac ? '⌘K' : 'Ctrl K';

const en: { title: string; intro: string; contents: string; askTitle: string; ask: string; sections: Section[] } = {
  title: 'Help',
  intro: 'How the admin works. Everything you save here goes into the band’s Google Sheet, and the website reads from that sheet, so changes show up on the site as soon as you save.',
  contents: 'On this page',
  askTitle: 'Still stuck?',
  ask: 'Ask Michael. If something here is wrong or missing, say so and this page gets updated.',
  sections: [
    {
      id: 'basics', icon: '★', title: 'The basics',
      points: [
        'Sign in with the Google account the band added to the admin list. A sign-in lasts about an hour. When it runs out, a banner asks you to sign in again, and nothing you typed is lost.',
        `Search (${searchKey}, or the Search button) finds shows, songs, releases, venues and people, and has shortcuts like “Add show”. Songs and releases are found by any of their titles or the reading: “Onboru”, “おんぼろ” and “オンボロ” all work.`,
        'A show, song, release or venue opens as a page to read. Each part has its own ✎: it opens a small window (or, for setlists and tracklists, editing right there) with Save and Cancel, so nothing changes by accident.',
        'Most things have English and Japanese fields. Fill in whichever you can: the site shows the other language when one is missing.',
        'If you try to leave a page with unsaved changes, it asks whether to save first.',
        'Deleting is permanent: it removes the row from the sheet. To take something off the site for now, hide it instead.',
        'At the bottom of the menu: switch the admin between English and 日本語, light and dark mode, this help page, and the website itself.',
        `On a computer, the « beside the logo folds the menu down to icons (hover one to see its name). ${isMac ? '⌘\\' : 'Ctrl+\\'} does the same, and ${isMac ? '⌘⇧D' : 'Ctrl+Shift+D'} switches light and dark mode.`,
      ],
    },
    {
      id: 'shows', icon: '♪', title: 'Shows',
      link: { to: 'events', label: 'Open Shows' },
      points: [
        'Add a show with the date, venue, times, prices, ticket link and flyer. Type to find a venue, or add a new one right there.',
        'Leave the show title blank for a regular gig: the site shows the venue name instead.',
        '“Goes live” decides when the show appears on the site: now, at a set time (Japan time), or hidden as a draft that only the admin can see.',
        'Setlist: type song titles, drag ⇅ to reorder, and add sets and encores. It goes public the day after the show, so you can fill it in on the night without spoilers. You can pick a different time.',
        'Home lists recent shows that don’t have a setlist yet.',
        'Videos (band only, not on the site): open the show’s Videos with ✎ and paste a YouTube link. Play it and press “Now” as each song starts; the songs come from the setlist. Each marked song then shows up on that song’s page. Outside ✎ the videos are just for watching (tap a song to jump to it), and removing a video always asks first.',
      ],
    },
    {
      id: 'reservations', icon: '🎫', title: 'Reservations',
      link: { to: 'reservations', label: 'Open Reservations' },
      points: [
        'Turn it on in a show’s Tickets section with “Take reservations on the site”. Then set how many tickets there are (the form closes by itself when they’re gone), the most per person (blank = 4), and when the form closes (blank = 23:59 the day before, Japan time).',
        'Fans fill in the form on the show page, check it on a confirmation screen, and get an email straight away, in the language of the page they used. Nobody needs to reply by hand. The band gets an email for each booking too.',
        'If someone books again with the same email, the new booking replaces the old one.',
        'Add a reservation by hand for bookings by DM, phone or in person. You can choose whether to send them the confirmation email.',
        'Tap a booking to edit it, cancel it, or send the email again. Cancelled bookings don’t count towards the total.',
        '“Copy list for the venue” copies a list sorted by name, with the total, to paste into an email or LINE. CSV opens in a spreadsheet.',
        'Door mode is for the night of the show: open it on a phone and tap each name as they arrive. The bar at the top counts who’s in.',
        'Don’t run the site form and an old Google Form for the same show at the same time.',
      ],
    },
    {
      id: 'messages', icon: '✉', title: 'Messages',
      link: { to: 'messages', label: 'Open Messages' },
      points: [
        'Messages from the contact form on the site land here, and each one is also emailed to the band.',
        'Reply opens your email app. Afterwards, tap “Mark as done” so it leaves the “New” count.',
        'Fans can also send setlist info (with photos) from a show page. Those messages link straight to that show’s setlist.',
      ],
    },
    {
      id: 'posts', icon: '✎', title: 'News, blog and photos',
      points: [
        'News: a title and text in each language, an optional image, and when it goes live. Line breaks are kept as you type; a blank line starts a new paragraph. Select words and use Link or Bold.',
        'Blog posts are Instagram posts: open the post on Instagram, tap ⋯ → Copy link, and paste it in.',
        'Photos rotate on the home page in the order shown in Photos. Drag them to change it (or use ‹ › on a phone).',
        'A photo can link to a show or any page: its caption on the home page becomes a button. For a show, leave the caption blank to show the date and venue. A flyer linked to a show disappears from the home page by itself once the show is over.',
        'One photo can also be the About page photo.',
        'One photo can be the link preview picture: what LINE, X, Slack and the like show when someone shares the home page (or the Events, News… lists). Turn on “Link preview” for it in Photos. A wide photo (about 1200×630) looks best, and it works even when the photo is hidden from the home page. Show and release pages use their own flyer or cover instead. Apps that already showed the link may keep the old picture for a while.',
        'The home page shows the latest four blog posts as Instagram thumbnails, by itself: nothing to add.',
      ],
    },
    {
      id: 'music', icon: '♫', title: 'Music',
      link: { to: 'songs', label: 'Open Songs' },
      points: [
        'Songs is a table: click a heading to sort (again to reverse), and combine the filters (no lyrics, no key, never played…) or pick a key.',
        'Each song has an English title and a reading. The English title is how fans outside Japan know it (usually romaji, as on Apple Music and Spotify); English pages show it first. The reading (hiragana or katakana, either is fine) puts Japanese pages in 50音 order. Releases have the same two fields.',
        'Keys (band only): a song can have several, in order, each with an optional label like “サビ” or “after the key change”.',
        'Each song can have music and lyrics credits, an original artist (for covers), and lyrics in a Google Doc that you can create from the song page.',
        'Renaming a song changes its title everywhere it’s used, so setlists and releases stay linked.',
        'A song’s Videos section gathers every live video with that song marked, plus videos of the song on its own (add those there).',
        '“Needs a look” lists song titles in setlists or releases that don’t match any song. Add the song, or point it to the right one.',
        'Releases can be a list or a table. The table shows how many tracks have been played live, and four marks (cover, tracks, notes, link): dashed means missing. “Missing info” lists the ones with gaps.',
        'A release’s tracklist is edited right on its page and links to Songs.',
        'Listen links: one per service (Apple Music, Spotify, YouTube Music, Amazon Music, LINE MUSIC), plus an “all services page” like song.link for the rest. Paste a link in any box and it moves to the right one. Check song.link’s results: it guesses, and sometimes finds the wrong album.',
      ],
    },
    {
      id: 'places', icon: '⌖', title: 'Venues and places',
      link: { to: 'venues', label: 'Open Venues' },
      points: [
        'Venues sit in areas (like Shimokitazawa), areas in prefectures, and prefectures in countries.',
        'A venue’s page shows its map, the next show there, every show by year (and which still need a setlist), and the songs played there most: handy for planning a set.',
        'Anything still in use, like a venue with shows, can’t be deleted.',
      ],
    },
    {
      id: 'sheet', icon: '▦', title: 'Behind the scenes',
      points: [
        'All the data lives in the band’s Google Sheet. You can edit it there directly, but the admin is safer: never rename tabs or column headings, or the site can’t find them.',
        'Google limits how often the sheet can be read. If a page says it couldn’t load, wait a minute and try again.',
      ],
    },
  ],
};

const ja: typeof en = {
  title: 'ヘルプ',
  intro: '管理画面の使い方です。ここで保存した内容はバンドのGoogleスプレッドシートに書き込まれ、サイトはそのシートを読んでいます。保存するとすぐにサイトに反映されます。',
  contents: 'このページの内容',
  askTitle: 'わからないときは',
  ask: 'Michaelに聞いてください。このページの間違いや足りないところも、教えてもらえれば更新します。',
  sections: [
    {
      id: 'basics', icon: '★', title: '基本',
      points: [
        'バンドが管理者リストに登録したGoogleアカウントでログインします。ログインは約1時間有効です。切れたときは上にお知らせが出るので、もう一度ログインしてください。入力中の内容は消えません。',
        `検索（${searchKey}、または「検索」ボタン）で、ライブ・楽曲・リリース・会場・人物をまとめて探せます。「ライブを追加」などのショートカットもあります。曲とリリースは、どのタイトルでも読みでも見つかります（「Onboru」「おんぼろ」「オンボロ」どれでもOK）。`,
        'ライブ・曲・リリース・会場は、まず読むためのページとして開きます。各部分に ✎ があり、押すと小さな編集画面（セットリストと曲目はその場で編集）が開きます。保存かキャンセルを押すまで何も変わらないので、うっかり変えてしまうことはありません。',
        'ほとんどの項目に英語と日本語の欄があります。書ける方だけで大丈夫です。片方がないときは、サイトにもう片方の言語が表示されます。',
        '保存していない変更があるままページを離れようとすると、保存するか確認が出ます。',
        '削除は元に戻せません（シートから行が消えます）。一時的にサイトから下げたいときは、削除せず「非公開」にしてください。',
        'メニューの一番下に、管理画面の言語（English／日本語）、ライト／ダークモード、このヘルプ、サイトを見るボタンがあります。',
        `パソコンでは、ロゴの横の « でメニューをアイコンだけにたためます（アイコンにマウスを乗せると名前が出ます）。${isMac ? '⌘\\' : 'Ctrl+\\'} でも同じで、${isMac ? '⌘⇧D' : 'Ctrl+Shift+D'} でライト／ダークを切り替えられます。`,
      ],
    },
    {
      id: 'shows', icon: '♪', title: 'ライブ',
      link: { to: 'events', label: 'ライブを開く' },
      points: [
        '日付・会場・時間・料金・チケットのリンク・フライヤーを入れてライブを追加します。会場は名前を打つと候補が出ます。新しい会場はその場で追加できます。',
        '普通のライブならタイトルは空欄でOKです。サイトには会場名が表示されます。',
        '「公開」で、サイトに出るタイミングを選べます：すぐ／日時を指定（日本時間）／非公開（下書き。管理画面でしか見えません）。',
        'セットリスト：曲名を打って追加し、⇅ をドラッグして並べ替えます。セットやアンコールも追加できます。公開はライブの翌日なので、当日に入力してもネタバレになりません。公開日時は変更もできます。',
        'ホームには、セットリストがまだない最近のライブが表示されます。',
        '動画（バンドだけ。サイトには出ません）：ライブの「動画」の ✎ を押してYouTubeのリンクを貼ります。再生して、曲が始まったら「今」を押すと開始位置が付きます（曲はセットリストから）。付けた曲は、その曲のページの「動画」に出ます。✎ を押していないときは見るだけ（曲名を押すとそこへ飛びます）で、動画を削除するときは必ず確認が出ます。',
      ],
    },
    {
      id: 'reservations', icon: '🎫', title: '予約',
      link: { to: 'reservations', label: '予約を開く' },
      points: [
        'ライブの「チケット」欄で「サイトで予約を受け付ける」をオンにします。予約枠（埋まったら自動で締め切り）、1人あたりの上限（空欄＝4枚）、締め切り（空欄＝前日23:59、日本時間）を設定できます。',
        'お客さんはライブページのフォームに入力し、確認画面でチェックしてから予約します。確認メールはすぐに自動で届きます（予約したページの言語で）。手作業で返信する必要はありません。バンドにも予約ごとにメールが届きます。',
        '同じメールアドレスで予約し直すと、前の予約が新しい内容に置き換わります。',
        'DM・電話・対面で受けた予約は「予約を追加」から手で入れられます。確認メールを送るかどうかも選べます。',
        '予約をタップすると、編集・キャンセル・メールの再送ができます。キャンセルした予約は合計に入りません。',
        '「会場用にリストをコピー」で、名前順のリストと合計をコピーできます。メールやLINEにそのまま貼れます。CSVはスプレッドシート用です。',
        '「受付モード」はライブ当日用です。スマホで開いて、来た人の名前をタップしていきます。上のバーで来場人数がわかります。',
        '同じライブで、サイトの予約フォームと昔のGoogleフォームを同時に受け付けないようにしてください。',
      ],
    },
    {
      id: 'messages', icon: '✉', title: 'メッセージ',
      link: { to: 'messages', label: 'メッセージを開く' },
      points: [
        'サイトのお問い合わせフォームからのメッセージはここに届きます。同じ内容がバンドにもメールで届きます。',
        '「返信」を押すとメールアプリが開きます。返信したら「対応済みにする」を押すと、「未対応」の数から外れます。',
        'ライブページからセットリスト情報（写真つき）が送られてくることもあります。そのライブのセットリストへのリンクがつきます。',
      ],
    },
    {
      id: 'posts', icon: '✎', title: 'ニュース・ブログ・写真',
      points: [
        'ニュース：各言語のタイトルと本文、画像（任意）、公開のタイミングを入れます。改行は入力したとおりに反映され、空行で段落が分かれます。文字を選んでリンクや太字にできます。',
        'ブログはInstagramの投稿です。Instagramで投稿を開き、⋯ →「リンクをコピー」して貼り付けます。',
        '写真は「写真」に並んでいる順番でホームに表示されます。ドラッグで順番を変えられます（スマホでは ‹ › ボタン）。',
        '写真にはライブやほかのページへのリンクをつけられます。ホームのキャプションがそのページへのボタンになります。ライブの場合、キャプションが空欄なら日付と会場が表示されます。ライブにリンクしたフライヤーは、ライブが終わるとホームから自動で消えます。',
        '1枚をプロフィールページの写真にすることもできます。',
        '1枚を「リンクのプレビュー画像」にできます。トップページ（とイベント・ニュースなどの一覧）のリンクを LINE・X・Slack などで共有したときに出る画像です。「写真」の表で「プレビュー画像」をオンにします。横長（1200×630くらい）がきれいに出ます。非公開の写真でも使えます。ライブやリリースのページは、それぞれのフライヤーやジャケットが使われます。一度共有されたアプリでは、しばらく古い画像が出ることがあります。',
        'トップページには、最新のブログ4件がInstagramのサムネイルで自動的に出ます。追加の作業はいりません。',
      ],
    },
    {
      id: 'music', icon: '♫', title: '音楽',
      link: { to: 'songs', label: '楽曲を開く' },
      points: [
        '「楽曲」は表になっています。見出しを押すと並べ替え（もう一度で逆順）、絞り込み（歌詞なし・キーなし・未演奏など）は組み合わせられ、キーでも絞り込めます。',
        '曲ごとに英語タイトルと読みを入れられます。英語タイトルは海外のファンが知っている名前（たいていローマ字。Apple Music や Spotify の表記）で、英語ページではこちらが先に出ます。読みはひらがなでもカタカナでもよく、日本語ページの50音順に使われます。リリースにも同じ2つの欄があります。',
        'キー（バンドだけ）：1曲に複数のキーを順番に登録でき、「サビ」「転調後」などのラベルもつけられます。',
        '曲ごとに作曲・作詞のクレジット、原曲のアーティスト（カバーの場合）、歌詞を登録できます。歌詞はGoogleドキュメントで、曲のページから作成できます。',
        '曲名を変えると、使われているところ（セットリスト・リリース）もすべて変わるので、つながりは切れません。',
        '曲のページの「動画」には、その曲に開始位置が付いたライブ映像がすべて集まります。曲単体の動画もそこで追加できます。',
        '「要確認」には、どの曲とも一致しないセットリストやリリースの曲名が出ます。曲を追加するか、正しい曲を選んでください。',
        'リリースはリストと表で見られます。表では、ライブで演奏した曲数と、4つの印（ジャケット・曲・解説・リンク）が見られます。点線は未入力です。「未入力あり」で、足りないものがあるリリースだけ出せます。',
        'リリースの曲目は、そのリリースのページでその場で編集でき、「楽曲」とつながっています。',
        '試聴・配信リンク：サービスごと（Apple Music・Spotify・YouTube Music・Amazon Music・LINE MUSIC）に1つずつと、ほかのサービス用の「まとめページ」（song.link など）。どの欄に貼っても正しいサービスの欄に入ります。song.link は自動で探すので、違うアルバムが出ていないか確認してください。',
      ],
    },
    {
      id: 'places', icon: '⌖', title: '会場・エリア',
      link: { to: 'venues', label: '会場を開く' },
      points: [
        '会場はエリア（下北沢など）に、エリアは都道府県に、都道府県は国に属しています。',
        '会場のページには、地図、その会場の次のライブ、年ごとのライブ一覧（セットリストがまだのものもわかります）、その会場でよく演奏した曲が出ます。セットリストを考えるときに便利です。',
        'ライブがある会場など、使われているものは削除できません。',
      ],
    },
    {
      id: 'sheet', icon: '▦', title: 'しくみ',
      points: [
        'データはすべてバンドのGoogleスプレッドシートにあります。シートを直接編集することもできますが、管理画面からの方が安全です。タブ名や列の見出しは変えないでください（サイトが読めなくなります）。',
        'Googleにはシートを読める回数の上限があります。「読み込めませんでした」と出たら、1分ほど待ってからもう一度開いてください。',
      ],
    },
  ],
};

export default function AdminHelp() {
  const { locale, prefix } = useAdminT();
  const t = locale === 'ja' ? ja : en;

  const jump = (id: string) => {
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="lu-help">
      <div className="lu-page-head">
        <div>
          <h1>{t.title}</h1>
          <p className="lu-hint">{t.intro}</p>
        </div>
      </div>

      <nav className="lu-help-toc" aria-label={t.contents}>
        {t.sections.map(sec => (
          <button key={sec.id} type="button" className="lu-pill" onClick={() => jump(sec.id)}>
            <span aria-hidden="true">{sec.icon}</span>&nbsp;{sec.title}
          </button>
        ))}
      </nav>

      {t.sections.map(sec => (
        <section key={sec.id} id={`help-${sec.id}`} className="lu-help-section">
          <div className="lu-help-head">
            <h2><span className="lu-help-icon" aria-hidden="true">{sec.icon}</span>{sec.title}</h2>
            {sec.link && <Link to={`${prefix}/${sec.link.to}`} className="lu-help-link">{sec.link.label} →</Link>}
          </div>
          <ul>
            {sec.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </section>
      ))}

      <section className="lu-help-section lu-help-ask">
        <h2>{t.askTitle}</h2>
        <p>{t.ask}</p>
      </section>
    </div>
  );
}
