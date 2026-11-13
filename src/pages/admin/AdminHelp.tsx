import Icon, { type IconName } from '../../components/admin/Icon';
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
  icon: IconName;
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
      id: 'basics', icon: 'star', title: 'The basics',
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
      id: 'shows', icon: 'shows', title: 'Shows',
      link: { to: 'events', label: 'Open Shows' },
      points: [
        'Add a show with the date, venue, times, prices, ticket link and flyer. Type to find a venue, or add a new one right there.',
        'Leave the show title blank for a regular gig: the site shows the venue name instead.',
        'Adding a show on a date that already has one at the same venue? An orange note says so (with a link to it), and saving asks you to confirm, so the same show doesn’t go in twice. Another show that day at a different venue is just listed for a look.',
        '“Goes live” decides when the show appears on the site: now, at a set time (Japan time), or hidden as a draft that only the admin can see.',
        'Setlist: type song titles, drag ⇅ to reorder, and add sets and encores. It goes public the day after the show, so you can fill it in on the night without spoilers. You can pick a different time.',
        'Home lists recent shows that don’t have a setlist yet.',
        'Found a video with the setlist in its description? In the setlist editor, “Paste a setlist”: paste the timestamps (and the video’s link) and they become the setlist, with the video added and every song marked. MC, SE and the like are skipped. To fill in the times of a video on a show that already has its setlist, edit the videos and use “Paste the timestamps” on that video.',
        'Found a setlist online (LiveFans, setlist.fm, a fan’s blog)? Same box: copy the list and paste it. Numbering, “アンコール” / “Encore” / “EN1.”, “第二部” / “Set 2” and one-line lists (“シトラス / めまい / 地球”) are all understood, and notes like “（新曲）” or “※初披露” go into the song’s notes. Paste the page’s link in “Where it’s from” and it becomes the setlist’s source.',
        'Source (in the setlist editor, band only): where a setlist was found, as a link or a note (“fan blog”, “the flyer”, “a DM from a fan”). It never appears on the site. A setlist made from a video’s timestamps gets the video as its source automatically.',
        'The day a setlist is first entered is saved with it. In Shows, sort by “Setlists, newest added” to see what’s new in the archive.',
        'Videos (band only, not on the site): open the show’s Videos with ✎ and paste a YouTube link. Play it and press “Now” as each song starts; the songs come from the setlist. Each marked song then shows up on that song’s page. Outside ✎ the videos are just for watching (tap a song to jump to it), and removing a video always asks first.',
      ],
    },
    {
      id: 'reservations', icon: 'reservations', title: 'Reservations',
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
      id: 'messages', icon: 'messages', title: 'Messages',
      link: { to: 'messages', label: 'Open Messages' },
      points: [
        'Messages from the contact form on the site land here, and each one is also emailed to the band.',
        'Reply opens your email app. Afterwards, tap “Mark as done” so it leaves the “New” count.',
        'Fans can also send setlist info (with photos) from a show page. Those messages link straight to that show’s setlist.',
        'Filtering a sender (“Filter this sender” on a message, or the list in the Filtered tab): their messages, old and new, leave the inbox and the New count and are kept in Filtered. They’re never emailed to the band, only to the separate address set there. Nothing changes for them: the form says “sent”, and no email ever goes to them, reservation confirmations included. Add each misspelling of their address too.',
        'Addresses a typo or two away from a filtered one aren’t filtered, but they’re marked ⚠ (in Messages, Reservations and door mode) so you can check. A booking from a filtered or ⚠ address gets no confirmation email.',
      ],
    },
    {
      id: 'posts', icon: 'news', title: 'News, blog and photos',
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
      id: 'music', icon: 'songs', title: 'Music',
      link: { to: 'songs', label: 'Open Songs' },
      points: [
        'Songs is a table: click a heading to sort (again to reverse), and combine the filters (no lyrics, no key, never played…) or pick a key.',
        'Each song has an English title and a reading. The English title is how fans outside Japan know it (usually romaji, as on Apple Music and Spotify); English pages show it first. The reading (hiragana or katakana, either is fine) puts Japanese pages in 50音 order. Releases have the same two fields.',
        'Keys (band only): a song can have several, in order, each with an optional label like “サビ” or “after the key change”.',
        'Each song can have music and lyrics credits, an original artist (for covers), and lyrics in a Google Doc that you can create from the song page.',
        'Renaming a song changes its title everywhere it’s used, so setlists and releases stay linked.',
        'Next to a song’s ✎: Public / Draft. A draft has no page on the website (only the band sees it), but its title still shows in setlists and tracklists, unlinked. Handy for new songs. Next to the lyrics’ ✎: Shown / Hidden, to keep the lyrics off the site (e.g. until the release) while the song page is live; the page then says the lyrics are coming soon. Both save as soon as you flip them, and hidden lyrics can’t be read from the site at all.',
        'A song’s Videos section gathers every live video with that song marked, plus videos of the song on its own (add those there).',
        '“Needs a look” lists song titles in setlists or releases that don’t match any song. Add the song, or point it to the right one.',
        'Videos (in the menu under Music) has every video in one place: show videos with their marked songs, and songs’ own videos. Search by anything (a song’s Japanese or English title or reading, the show, venue, city, date), filter by type or year, and play one right there, jumping between its songs. “Needs marking” lists show videos with no songs marked yet.',
        '“+ Add a video” on the Videos page walks you through it: paste the link (the title fills in, and a video already added is caught), say whether it’s live or a video of a song, pick the show (suggested from a date in the title, like 2025-11-30) or the song, then tick the songs in it and, if you know, when each starts (505 for 5:05). One song alone starts at 0:00. Times can also be added later on the show’s page.',
        'A show that isn’t in the archive yet can be added right there (“A show that isn’t in the archive yet”): date and venue are enough. Then paste the timestamps from the video’s description (“0:00 Hello mate! / 4:12 シトラス / …”): they become the show’s setlist with every song already marked. Song names match by any title or reading; ones that don’t match are marked “new song” (fix or remove them before saving). Lines like MC, SE or Encore are skipped. For a show that already has a setlist, pasting fills in the times.',
        'Any YouTube link works, not just the band’s own: fans’ videos of a show can be added on that show (or a song) the same way, and their title fills in by itself. They stay band-only here. A fan can delete their video or make it private at any time, and then it won’t play any more.',
        'Every few hours the site checks that each video still plays and each listen link still works. Ones that don’t are counted in “What’s missing” on Home, marked on the Videos page (Deleted / Private) and shown crossed out on the release.',
        'Releases can be a list or a table. The table shows how many tracks have been played live, and four marks (cover, tracks, notes, link): dashed means missing. “Missing info” lists the ones with gaps.',
        'A release’s tracklist is edited right on its page and links to Songs.',
        'Listen links: one per service (Apple Music, Spotify, YouTube Music, Amazon Music, LINE MUSIC), plus an “all services page” like song.link for the rest. Paste a link in any box and it moves to the right one. Check song.link’s results: it guesses, and sometimes finds the wrong album.',
      ],
    },
    {
      id: 'places', icon: 'venues', title: 'Venues and places',
      link: { to: 'venues', label: 'Open Venues' },
      points: [
        'Venues sit in areas (like Shimokitazawa), areas in prefectures, and prefectures in countries.',
        'A venue’s page shows its map, the next show there, every show by year (and which still need a setlist), and the songs played there most: handy for planning a set.',
        'A venue that changed its name (ON AIR WEST → Shibuya O-WEST → Spotify O-WEST) stays one venue: keep its current name, and add the old ones under Former names (✎) with the month each changed. Shows before then read with the old name (“now Spotify O-WEST” beside it), and searching an old name finds the venue.',
        'Adding a venue: if one with a similar name is already in (ナミキジャンクション vs 並木ジャンクション, or an old name of it), a note lists it. Use that one instead (“Use this one” when adding from a show), or confirm to add a new one.',
        'A venue that’s in twice, or an old name that got its own venue (NEST and O-nest): open it, ✎, “Merge into…”. Its shows move over and its name becomes a former name.',
        'Home → What’s missing lists shows and venues that may be in twice; open the line to see them.',
        'Anything still in use, like a venue with shows, can’t be deleted.',
      ],
    },
    {
      id: 'data', icon: 'data', title: 'Data',
      link: { to: 'data', label: 'Open Data' },
      points: [
        'The archive in numbers: shows per year, the most played songs, each year’s favourites, openers, closers and encores, debuts, the longest gaps, songs not played lately, the venues played most, and songs never played live.',
        'Song counts come from the setlists in the archive, so the more setlists are filled in, the truer they get. The page says how many past shows have one.',
        'Hover over (or tap) a year in the chart for its numbers, or open it as a table. Only the band sees this page.',
      ],
    },
    {
      id: 'history', icon: 'history', title: 'History and recent changes',
      link: { to: 'activity', label: 'Open Recent changes' },
      points: [
        'Every save in the admin is recorded: who made it, when, and what changed (for example “title: グッバイ → Good Bye”, or which songs were added to a setlist).',
        'Each show, song, release, venue and post has a History section at the bottom of its page. Recent changes lists everything, by day, and you can filter by kind or by person.',
        'A show saved with its setlist and videos reads as one change. Saves that changed nothing aren’t recorded.',
        'It’s private: only signed-in band members see it, and it starts from the day it was added (older edits aren’t in it). Who’s on the sender filter list is never written to it, only that the list changed.',
      ],
    },
    {
      id: 'sheet', icon: 'table', title: 'Behind the scenes',
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
      id: 'basics', icon: 'star', title: '基本',
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
      id: 'shows', icon: 'shows', title: 'ライブ',
      link: { to: 'events', label: 'ライブを開く' },
      points: [
        '日付・会場・時間・料金・チケットのリンク・フライヤーを入れてライブを追加します。会場は名前を打つと候補が出ます。新しい会場はその場で追加できます。',
        '普通のライブならタイトルは空欄でOKです。サイトには会場名が表示されます。',
        '同じ日・同じ会場のライブがもうあるときは、オレンジのお知らせ（リンクつき）が出て、保存の前に確認します。同じライブを二重に登録しないためです。同じ日の別の会場のライブは、参考として表示されるだけです。',
        '「公開」で、サイトに出るタイミングを選べます：すぐ／日時を指定（日本時間）／非公開（下書き。管理画面でしか見えません）。',
        'セットリスト：曲名を打って追加し、⇅ をドラッグして並べ替えます。セットやアンコールも追加できます。公開はライブの翌日なので、当日に入力してもネタバレになりません。公開日時は変更もできます。',
        'ホームには、セットリストがまだない最近のライブが表示されます。',
        '説明欄にセットリストがある動画を見つけたら：セットリストの編集画面で「セットリストを貼り付け」。タイムスタンプ（と動画のリンク）を貼り付けると、そのままセットリストになり、動画も全曲の位置つきで追加されます。MC・SEなどは飛ばされます。セットリストがすでにあるライブの動画に時間を入れるときは、動画を編集して、その動画の「タイムスタンプを貼り付け」を使います。',
        'ネットでセットリストを見つけたら（LiveFans、setlist.fm、ファンのブログなど）：同じ欄にコピーして貼り付けるだけです。番号、「アンコール」「Encore」「EN1.」、「第二部」「Set 2」、1行にまとめたリスト（「シトラス / めまい / 地球」）も読み取り、「（新曲）」「※初披露」などはその曲のメモに入ります。ページのリンクを「出典のリンク」に入れると、セットリストの出典になります。',
        '出典（セットリストの編集画面、バンドだけ）：セットリストをどこで見つけたか。リンクやメモ（「ファンのブログ」「フライヤー」「ファンからのDM」など）を入れます。サイトには表示されません。動画のタイムスタンプから作ったセットリストは、その動画が自動で出典になります。',
        'セットリストを初めて入力した日も保存されます。「ライブ」の並び替えで「セトリ追加が新しい順」を選ぶと、アーカイブに新しく加わったものがわかります。',
        '動画（バンドだけ。サイトには出ません）：ライブの「動画」の ✎ を押してYouTubeのリンクを貼ります。再生して、曲が始まったら「今」を押すと開始位置が付きます（曲はセットリストから）。付けた曲は、その曲のページの「動画」に出ます。✎ を押していないときは見るだけ（曲名を押すとそこへ飛びます）で、動画を削除するときは必ず確認が出ます。',
      ],
    },
    {
      id: 'reservations', icon: 'reservations', title: '予約',
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
      id: 'messages', icon: 'messages', title: 'メッセージ',
      link: { to: 'messages', label: 'メッセージを開く' },
      points: [
        'サイトのお問い合わせフォームからのメッセージはここに届きます。同じ内容がバンドにもメールで届きます。',
        '「返信」を押すとメールアプリが開きます。返信したら「対応済みにする」を押すと、「未対応」の数から外れます。',
        'ライブページからセットリスト情報（写真つき）が送られてくることもあります。そのライブのセットリストへのリンクがつきます。',
        '送信者のフィルター（メッセージの「この送信者をフィルター」、または「フィルター」タブの一覧）：その人のメッセージは過去のものも含めて受信一覧と「未対応」の数から外れ、「フィルター」に保存されます。バンドのメールには届かず、そこで設定した別のアドレスにだけ送られます。相手には何も変わりません。フォームは「送信しました」と表示され、予約の確認メールも含め、相手にメールが送られることはありません。打ち間違いのアドレスも追加してください。',
        'フィルター中のアドレスと1〜2文字違いのアドレスはフィルターされませんが、⚠ がつきます（メッセージ・予約・受付モード）。フィルター中または ⚠ のアドレスからの予約には、確認メールは送られません。',
      ],
    },
    {
      id: 'posts', icon: 'news', title: 'ニュース・ブログ・写真',
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
      id: 'music', icon: 'songs', title: '音楽',
      link: { to: 'songs', label: '楽曲を開く' },
      points: [
        '「楽曲」は表になっています。見出しを押すと並べ替え（もう一度で逆順）、絞り込み（歌詞なし・キーなし・未演奏など）は組み合わせられ、キーでも絞り込めます。',
        '曲ごとに英語タイトルと読みを入れられます。英語タイトルは海外のファンが知っている名前（たいていローマ字。Apple Music や Spotify の表記）で、英語ページではこちらが先に出ます。読みはひらがなでもカタカナでもよく、日本語ページの50音順に使われます。リリースにも同じ2つの欄があります。',
        'キー（バンドだけ）：1曲に複数のキーを順番に登録でき、「サビ」「転調後」などのラベルもつけられます。',
        '曲ごとに作曲・作詞のクレジット、原曲のアーティスト（カバーの場合）、歌詞を登録できます。歌詞はGoogleドキュメントで、曲のページから作成できます。',
        '曲名を変えると、使われているところ（セットリスト・リリース）もすべて変わるので、つながりは切れません。',
        '曲の ✎ の横の「公開／下書き」：下書きの曲はサイトにページがありません（バンドだけが見られます）。セットリストや曲目には曲名だけ（リンクなし）で出ます。新曲などに。歌詞の ✎ の横の「表示／非表示」：曲のページは公開したまま、歌詞だけをサイトに出さないようにできます（リリースまでなど）。その間、曲のページには「歌詞は後日公開予定です」と出ます。どちらも切り替えるとすぐ保存され、非表示の歌詞はサイトから読むこともできません。',
        '曲のページの「動画」には、その曲に開始位置が付いたライブ映像がすべて集まります。曲単体の動画もそこで追加できます。',
        '「要確認」には、どの曲とも一致しないセットリストやリリースの曲名が出ます。曲を追加するか、正しい曲を選んでください。',
        '「動画」（メニューの音楽の中）には、すべての動画がまとまっています。ライブの動画（曲の位置つき）と、曲単体の動画です。曲名（日本語・英語・読み）、ライブ、会場、街、日付など何でも検索でき、種類や年で絞り込めます。その場で再生して、曲から曲へ飛べます。「曲の位置が未入力」には、まだ曲の位置を入れていないライブ動画が出ます。',
        '「動画」ページの「＋ 動画を追加」で、順番に入力できます。リンクを貼る（タイトルは自動で入り、追加済みの動画なら知らせます）→ ライブ映像か曲の動画かを選ぶ → ライブ（タイトルに 2025-11-30 などの日付があれば候補に出ます）か曲を選ぶ → 入っている曲にチェックし、わかれば始まる時間を入れる（505 で 5:05）。1曲だけなら 0:00 からになります。時間は後でライブのページから入れることもできます。',
        'アーカイブにまだないライブは、その場で追加できます（「アーカイブにまだないライブ」）。日付と会場だけでOKです。動画の説明欄のタイムスタンプ（「0:00 Hello mate! / 4:12 シトラス / …」）を貼り付けると、そのままセットリストになり、全曲の位置も入ります。曲名はどのタイトルでも読みでも一致し、一致しないものには「新しい曲」と出ます（保存前に直すか削除してください）。MC・SE・アンコールなどの行は飛ばされます。セットリストがあるライブなら、貼り付けると時間だけが入ります。',
        'バンドの動画だけでなく、YouTubeのリンクなら何でも使えます。ファンが上げたライブ動画も、そのライブ（または曲）のページから同じように追加でき、タイトルは自動で入ります。ここではバンドだけが見られます。ファンの動画は削除や非公開にされることがあり、そうなると再生できなくなります。',
        '数時間ごとに、動画が再生できるか、配信リンクが使えるかを自動で確かめています。使えなくなったものは、ホームの「足りないもの」に数が出て、「動画」ページでは「削除済み／非公開」と表示され、リリースのページでは取り消し線で示されます。',
        'リリースはリストと表で見られます。表では、ライブで演奏した曲数と、4つの印（ジャケット・曲・解説・リンク）が見られます。点線は未入力です。「未入力あり」で、足りないものがあるリリースだけ出せます。',
        'リリースの曲目は、そのリリースのページでその場で編集でき、「楽曲」とつながっています。',
        '試聴・配信リンク：サービスごと（Apple Music・Spotify・YouTube Music・Amazon Music・LINE MUSIC）に1つずつと、ほかのサービス用の「まとめページ」（song.link など）。どの欄に貼っても正しいサービスの欄に入ります。song.link は自動で探すので、違うアルバムが出ていないか確認してください。',
      ],
    },
    {
      id: 'places', icon: 'venues', title: '会場・エリア',
      link: { to: 'venues', label: '会場を開く' },
      points: [
        '会場はエリア（下北沢など）に、エリアは都道府県に、都道府県は国に属しています。',
        '会場のページには、地図、その会場の次のライブ、年ごとのライブ一覧（セットリストがまだのものもわかります）、その会場でよく演奏した曲が出ます。セットリストを考えるときに便利です。',
        '名前が変わった会場（ON AIR WEST → 渋谷 O-WEST → Spotify O-WEST など）は、ひとつの会場のままにします。今の名前にして、✎ の「以前の名前」に昔の名前と改称した月を入れてください。それより前のライブは昔の名前で表示され（横に「現・Spotify O-WEST」）、昔の名前で検索しても見つかります。',
        '会場を追加するとき、似た名前の会場（ナミキジャンクションと並木ジャンクション、昔の名前など）がもうあれば、お知らせが出ます。そちらを使うか（ライブから追加するときは「これを使う」）、確認してから新しく追加してください。',
        '二重に登録された会場や、昔の名前で別に登録された会場（NEST と O-nest など）は、その会場を開いて ✎ →「まとめる…」。ライブが移り、その名前は「以前の名前」になります。',
        'ホームの「足りないもの」に、二重に登録されているかもしれないライブと会場が出ます。開くと一覧が見られます。',
        'ライブがある会場など、使われているものは削除できません。',
      ],
    },
    {
      id: 'data', icon: 'data', title: 'データ',
      link: { to: 'data', label: 'データを開く' },
      points: [
        'アーカイブを数字で：年ごとのライブ数、よく演奏した曲、年ごとのよく演奏した曲、1曲目・本編ラスト・アンコール、初演、いちばん間が空いた曲、最近演奏していない曲、よく出演した会場、ライブで演奏していない曲。',
        '曲の回数はアーカイブにあるセットリストから数えています。セットリストが増えるほど正確になります。過去のライブのうちセットリストがある本数もページに出ます。',
        'グラフの年にカーソルを合わせる（タップする）と数字が出ます。表で見ることもできます。バンドだけが見られるページです。',
      ],
    },
    {
      id: 'history', icon: 'history', title: '履歴と最近の変更',
      link: { to: 'activity', label: '最近の変更を開く' },
      points: [
        '管理画面での保存はすべて記録されます：だれが、いつ、何を変えたか（たとえば「タイトル：グッバイ → Good Bye」や、セットリストに追加された曲）。',
        'ライブ・曲・リリース・会場・投稿のページのいちばん下に「履歴」があります。「最近の変更」では、すべての変更を日ごとに見られ、種類や人で絞り込めます。',
        'セットリストや動画といっしょに保存したライブは、ひとつの変更として表示されます。何も変わっていない保存は記録されません。',
        'バンドのメンバーだけが見られます。記録はこの機能を入れた日から始まります（それより前の編集は入っていません）。送信者フィルターの中身は記録せず、変更したことだけを残します。',
      ],
    },
    {
      id: 'sheet', icon: 'table', title: 'しくみ',
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
            <span aria-hidden="true"><Icon name={sec.icon} /></span>&nbsp;{sec.title}
          </button>
        ))}
      </nav>

      {t.sections.map(sec => (
        <section key={sec.id} id={`help-${sec.id}`} className="lu-help-section">
          <div className="lu-help-head">
            <h2><span className="lu-help-icon" aria-hidden="true"><Icon name={sec.icon} /></span>{sec.title}</h2>
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
