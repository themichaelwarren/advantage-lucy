/**
 * GET /api/admin/whoami: 200 if the token belongs to an admin. The check
 * itself is in ./_middleware.ts (401/403 otherwise), so the admin list
 * never has to be in the browser.
 */
export const onRequestGet: PagesFunction = async () => Response.json({ ok: true });
