import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useBlog } from '../hooks/useSheetData';
import PageLoader from '../components/PageLoader';
import NotFound from '../components/NotFound';

interface Props {
  locale: Locale;
}

/**
 * Blog posts don't have their own page any more: the list opens them on
 * Instagram. Old /blog/:id links (shared before) go on to the post there.
 */
export default function BlogDetail({ locale }: Props) {
  const s = t(locale);
  const { id } = useParams<{ id: string }>();
  const { blog, loading } = useBlog();
  const post = blog.find(b => b.id === id);

  useEffect(() => {
    if (post?.instagram_url) window.location.replace(post.instagram_url);
  }, [post]);

  if (loading || post?.instagram_url) return <PageLoader locale={locale} />;
  return <NotFound locale={locale} what={locale === 'ja' ? 'この投稿' : 'This post'} back={{ to: `/${locale}/blog`, label: s.blog.title }} />;
}
