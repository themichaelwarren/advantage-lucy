import type { Locale } from '../i18n/translations';

const CONTACT_EMAIL = 'advantagelucyofficial@gmail.com';
const UPDATED = '2026-11-08';

/**
 * Privacy policy. Also the page Google's OAuth consent screen links to, so it
 * must keep describing the admin sign-in scopes accurately (see AuthContext:
 * email, profile, drive.file). Update it if those change.
 */
export default function Privacy({ locale }: { locale: Locale }) {
  return locale === 'ja' ? <Ja /> : <En />;
}

function En() {
  return (
    <>
      <header className="news-detail-header">
        <h1 className="news-detail-title">Privacy</h1>
        <span className="news-detail-date">Last updated {UPDATED}</span>
      </header>
      <div className="prose">
        <p>This is the website of the band advantage Lucy. We keep it simple: we don’t run analytics or advertising, and we don’t sell or share anyone’s information.</p>

        <h2>Visiting the site</h2>
        <p>The site doesn’t use tracking cookies. Your browser remembers one thing for you: whether you chose light or dark mode. That choice stays on your device.</p>
        <p>Some pages show content from other services, which may set their own cookies under their own privacy policies:</p>
        <ul>
          <li>Blog posts are Instagram posts embedded from <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer">Instagram</a>.</li>
        </ul>
        <h2>Contact form</h2>
        <p>When you send a message or share setlist info, we receive what you enter (your name, email address and message) and any photos you attach. Photos are resized in your browser before sending, which also removes hidden details such as location. It's stored in the band's private Google Sheet and emailed to the band, so we can reply. We use it for nothing else, and you can ask us to delete it at any time.</p>
        <p>Links to Instagram, X, Facebook, YouTube and SoundCloud take you to those sites; their own policies apply there.</p>

        <h2>Signing in with Google</h2>
        <p>Band members can sign in with Google to update the site. Signing in gives the site:</p>
        <ul>
          <li><strong>Your email address and basic profile</strong>, to confirm who is signing in.</li>
          <li><strong>Access only to Google Drive files the site itself creates</strong> (<code>drive.file</code>), used to create documents for the site. It can’t see any other files in your Drive.</li>
        </ul>
        <p>This information isn’t sold or shared. The site’s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

        <h2>Questions</h2>
        <p>Write to us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </div>
    </>
  );
}

function Ja() {
  return (
    <>
      <header className="news-detail-header">
        <h1 className="news-detail-title">プライバシー</h1>
        <span className="news-detail-date">最終更新日 {UPDATED}</span>
      </header>
      <div className="prose">
        <p>このサイトはバンド advantage Lucy のウェブサイトです。アクセス解析や広告は使っておらず、個人情報を販売・共有することはありません。</p>

        <h2>サイトの閲覧について</h2>
        <p>このサイトはトラッキング用のCookieを使用していません。ブラウザに保存されるのは、ライトモード／ダークモードの選択だけで、その情報はお使いの端末内にのみ残ります。</p>
        <p>一部のページでは外部サービスのコンテンツを表示しています。これらのサービスは、それぞれのプライバシーポリシーに基づいてCookieを使用する場合があります。</p>
        <ul>
          <li>ブログは<a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer">Instagram</a>の投稿を埋め込んで表示しています。</li>
        </ul>
        <h2>お問い合わせフォーム</h2>
        <p>メッセージやセットリスト情報を送信すると、入力内容（お名前・メールアドレス・内容）と添付した写真がバンドに届きます。写真は送信前にブラウザで縮小され、位置情報などの隠れた情報も削除されます。これらはバンドの非公開のGoogleスプレッドシートに保存され、返信のためにバンドへメールで送られます。返信以外の目的には使用せず、ご依頼があればいつでも削除します。</p>
        <p>Instagram、X、Facebook、YouTube、SoundCloud へのリンク先では、各サービスのポリシーが適用されます。</p>

        <h2>Googleでのログインについて</h2>
        <p>バンドメンバーはサイトを更新するため、Googleアカウントでログインできます。ログインすると、サイトは次の情報にアクセスします。</p>
        <ul>
          <li><strong>メールアドレスと基本的なプロフィール</strong>：ログインする人の確認のため。</li>
          <li><strong>このサイト自身が作成したGoogleドライブのファイルのみ</strong>（<code>drive.file</code>）：サイト用のドキュメントを作成するため。ドライブ内のその他のファイルは見ることができません。</li>
        </ul>
        <p>これらの情報を販売・共有することはありません。Google APIから受け取った情報の利用は、<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API サービスのユーザーデータに関するポリシー</a>（限定使用の要件を含む）に従います。</p>

        <h2>お問い合わせ</h2>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> までご連絡ください。</p>
      </div>
    </>
  );
}
