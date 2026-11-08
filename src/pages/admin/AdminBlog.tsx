import { useAllBlog } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import { blogToRow } from '../../utils/adminRows';
import PostList from '../../components/admin/PostList';

export default function AdminBlog() {
  const { s, locale, prefix } = useAdminT();
  const { blog, loading } = useAllBlog();
  return (
    <PostList
      s={s} page="blog" title={s.blogTitle} addLabel={s.addBlog} base={`${prefix}/blog`}
      items={blog} loading={loading} tab="Blog" toRow={blogToRow}
      titleOf={p => (locale === 'ja' ? p.title_ja || p.title_en : p.title_en || p.title_ja) || p.instagram_url}
    />
  );
}
