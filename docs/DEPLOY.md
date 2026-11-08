# Deploying

## The website

Cloudflare Pages is linked to this GitHub repository. **Pushing to `gh-pages` deploys the live site.** There is no manual step and no wrangler command.

```sh
npm run build                      # optional local check: type check + build
git checkout gh-pages
git merge --ff-only <your-branch>
git push origin gh-pages
```

- Cloudflare builds with `npm run build` and serves `dist/`. The API in `functions/` (Pages Functions) deploys with it.
- The deploy takes a minute or two. Its progress shows as the **Cloudflare Pages** check on the commit in GitHub, which links to the build log.
- Pushing any other branch makes a preview deploy on a `*.pages.dev` address, not the live site. This is handy for trying something out first.
- To roll back, open the project's **Deployments** page in the Cloudflare dashboard and choose **Rollback** on an earlier deploy.

The **Deploy Jekyll site to Pages** GitHub Action in `.github/workflows/` is left over from the old GitHub Pages site. It fails on every push, and that failure doesn't matter.

## Settings and secrets

These are set in the Cloudflare dashboard (Pages project → Settings → Variables and Secrets) and in a local `.env` file, which is never committed. This list gives only the names. The values are kept in the dashboard, never in the repository.

| Name | What it is |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Service account that reads and writes the Google Sheet |
| `VITE_GOOGLE_SHEET_ID` | The sheet that holds the site's data |
| `VITE_LYRICS_FOLDER_ID` | Google Drive folder with the lyrics docs |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in for the admin pages |
| `VITE_ADMIN_EMAILS` | Comma-separated list of who may use the admin pages |
| `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Cloudflare Turnstile spam check on the forms |
| `RESEND_API_KEY`, `CONTACT_NOTIFY_TO`, `CONTACT_FROM` | Email notifications for contact messages and setlist tips |
| `SITE_URL` | Optional: the site address used for links in those emails |

- `VITE_` names are built into the page when Cloudflare builds it, so **after changing one, deploy again** (retry the latest deploy in the dashboard, or push).
- Other settings are read when a request comes in, and take effect on the next deploy.
- The R2 bucket for posters and fans' photos is bound as `POSTERS` in `wrangler.toml`.

## After a deploy

Do a quick check on the live site:

1. The home page and a show page load.
2. Sign in to `/en/admin`, save something small, and check the public page shows the change.
3. If forms or email code changed: send a test from the Contact page, then check the email arrives and appears under Admin → Messages.

## Running locally

```sh
npm install
npm run dev        # http://localhost:5173, uses .env
```

## The blog-ingest email worker

`workers/blog-ingest` is a separate Cloudflare Worker. It turns emails sent to the blog address into draft blog posts. It is **not** deployed by the push above. Deploy it by hand only when its code changes:

```sh
cd workers/blog-ingest
npx wrangler login     # once, with the band's Cloudflare account
npx wrangler deploy
```

It has its own secrets, set with `npx wrangler secret put <NAME>` (see the comment at the top of `src/index.ts`).
