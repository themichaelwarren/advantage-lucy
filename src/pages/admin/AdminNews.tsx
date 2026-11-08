import { useAllNews } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import { newsToRow } from '../../utils/adminRows';
import PostList from '../../components/admin/PostList';

export default function AdminNews() {
  const { s, locale, prefix } = useAdminT();
  const { news, loading } = useAllNews();
  return (
    <PostList
      s={s} page="news" title={s.newsTitle} addLabel={s.addNews} base={`${prefix}/news`}
      items={news} loading={loading} tab="News" toRow={newsToRow}
      titleOf={p => (locale === 'ja' ? p.title_ja || p.title_en : p.title_en || p.title_ja) || p.id}
    />
  );
}
