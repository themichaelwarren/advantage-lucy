import { useEffect } from 'react';

/**
 * Sets the browser tab title, "Title | advantage Lucy" (just
 * "advantage Lucy" on the home page). Same wording as the link-preview
 * tags the server adds (functions/lib/meta.ts).
 */
export default function PageTitle({ title }: { title?: string }) {
  useEffect(() => {
    document.title = title ? `${title} | advantage Lucy` : 'advantage Lucy';
  }, [title]);
  return null;
}
