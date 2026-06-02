This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

## Admin authentication

The admin area is available at `/admin`. It uses the MongoDB `users` collection for the admin user, MongoDB collections for auth challenges and sessions, optional Apple/iCloud SMTP for email codes and magic links, optional LinkedIn OAuth for admin sign-in, and an HTTP-only signed session cookie.

Required environment for any admin sign-in:

- `AUTH_SECRET` with at least 32 characters
- `MONGO_DB_URI`, `MONGO_DB_NAME`, `MONGO_DB_USER`, `MONGO_DB_PASSWORD`

Store the admin user in MongoDB's `users` collection:

```json
{
  "_id": "admin",
  "email": "your-admin-email@example.com",
  "name": "First- & Last Name",
  "passwordHash": "scrypt$64$16384$...",
  "createdAt": "2026-05-24T00:00:00.000Z",
  "updatedAt": "2026-05-24T00:00:00.000Z"
}
```

The `_id: "admin"` field marks that user as allowed to access the admin area. You can also use `role: "admin"`, `roles: ["admin"]`, or `isAdmin: true` if you prefer a different user document shape.

Required or recommended for email links:

- `APPLE_MAIL_USER`, `APPLE_MAIL_APP_PASSWORD`
- `APPLE_MAIL_FROM` defaults to `APPLE_MAIL_USER` if omitted
- Links use the current request host, so local emails point at `localhost` and deployed emails point at the active domain. `AUTH_BASE_URL` or `NEXT_PUBLIC_SITE_URL` can still be set as a fallback when no request host is available.

LinkedIn admin sign-in:

- Add the `Sign in with LinkedIn using OpenID Connect` product to the LinkedIn app.
- Set `LINKEDIN_AUTH_ENABLED=true`, `LINKEDIN_CLIENT_ID`, and `LINKEDIN_CLIENT_SECRET`.
- Add this local redirect URL in the LinkedIn app's Auth settings: `http://localhost:3000/api/admin/auth/linkedin/callback`.
- When the site moves to the domain, add the production redirect URL too: `https://your-domain.com/api/admin/auth/linkedin/callback`.
- LinkedIn requires an exact redirect URL match, including protocol, host, port, path, and no trailing slash.
- The app builds the callback URL from the current request origin, so `localhost`, `127.0.0.1`, tunnels, and the production domain each use their own matching `/api/admin/auth/linkedin/callback` URL. Add every origin you use to the LinkedIn app's allowed redirect URLs.
- There is no public sign-up flow. The LinkedIn account must return the same email address as an existing configured admin user in MongoDB, otherwise sign-in is rejected.
- To publish posts from `/admin/posts`, add the `Share on LinkedIn` product to the LinkedIn app. The admin publishing connect action requests `w_member_social` and stores the access token encrypted in MongoDB.
- The current publishing flow supports the connected member profile. Company page publishing requires separate LinkedIn organization permissions and organization selection before it can be enabled.
- When sharing a post, the admin can choose a saved site language, add optional LinkedIn commentary, include a supported attached image, and either share immediately or schedule the share. Post image uploads are limited to JPG, PNG, and GIF so attached images can be used by LinkedIn image publishing.
- Scheduled shares are optional. Set `LINKEDIN_SCHEDULER_ENABLED=true` and set the same random `LINKEDIN_SCHEDULER_SECRET` value in Netlify and your environment file to turn them on. Netlify must have these values in Site configuration > Environment variables, followed by a production redeploy; `.env.online` is only a local reference file.
- When enabled, scheduled shares are processed by the Netlify scheduled function in `netlify/functions/linkedin-scheduler.mjs`, which uses Netlify's inline `export const config = {schedule: "* * * * *"}` cron configuration and requires the `@netlify/functions` package. Netlify runs scheduled functions on UTC cron for published deploys only, and the function checks for due jobs every minute by calling `/api/admin/linkedin/scheduled`.
- Netlify scheduled functions have a 30 second execution limit and do not return response bodies. The scheduler logs the API result and processes one due job per run by default; set `LINKEDIN_SCHEDULER_BATCH_LIMIT` from `1` to `5` only if scheduled publishing remains comfortably under the Netlify limit. The admin LinkedIn panel shows the last recorded scheduler check; if it says no checks were recorded, Netlify has not invoked the scheduled function on the deployed site yet.
- `LINKEDIN_OAUTH_SCOPES` is optional and defaults to `openid profile email` for admin sign-in. `LINKEDIN_API_VERSION` is optional and defaults to `202605` for the LinkedIn Posts API. `LINKEDIN_REQUEST_TIMEOUT_MS` is optional and defaults to `20000`.

## Language detection

The public site calls `/api/language` on first load unless the visitor has manually selected a language. The route first reads platform country headers derived from the visitor IP, such as `x-vercel-ip-country`, `cf-ipcountry`, and `cloudfront-viewer-country`. If those are unavailable, it uses `IP_INFO_TOKEN` with IPinfo Lite to read the visitor country code from a forwarded public IP. German is shown for `AT`, `CH`, `DE`, `LI`, and `LU`; English is used for every other country or when detection is unavailable.

## Privacy consent

The public consent preference is stored in browser local storage. `NEXT_PUBLIC_CONSENT_STORAGE_KEY` can override the storage key; it defaults to `site-consent-preferences`.

## Site profile settings

Public profile settings are managed in `/admin/profile` and stored in MongoDB under the `site_content` document `_id: "profile_settings"`. This includes first and last name, site metadata, blog visibility, the contact address, and the Koalendar booking integration. The Impressum and privacy pages use the saved profile name and address for provider/controller details. Missing Koalendar settings initialize as disabled with an empty booking URL, and public booking CTAs read only from the saved profile setting.

## Blog posts

The blog system lets the admin build portfolio posts from `/admin/posts` and publish them into the public site. Posts are stored in the MongoDB `posts` collection and support `draft`, `published`, and `archived` states. Only `published` posts are returned by the public `/api/posts` endpoint and rendered on the homepage.

Main components and routes:

- `src/app/admin/posts/PostManager.jsx` is the admin editor. It handles the post list, title, status, summary, rich text body, media upload, and AI-assisted content actions.
- `src/app/admin/ai-settings/AiSettingsManager.jsx` is the global AI settings screen for the post assistant.
- `src/app/components/blog/BlogSection.jsx` renders published posts as cards in the public homepage blog section.
- `src/app/blog/[slug]/page.js` renders the full published post page with media, article content, share buttons, and Open Graph/Twitter metadata.
- `src/app/api/admin/posts/*` contains authenticated admin CRUD and AI helper routes.
- `src/app/api/admin/uploads/route.js` uploads post images and videos to DigitalOcean Spaces.

Post media is stored in DigitalOcean Spaces and saved on each post as a single optional `media` object. Supported public media types are image and video. The post editor keeps `Save post` as the primary action; contextual actions such as new posts, AI generation, and uploads use secondary button styling to keep the admin hierarchy clear.

AI assistance is available in the post editor for three workflows:

- `Create` generates a new draft from a prompt.
- `Tweak` rewrites or improves the current draft based on instructions.
- `Translate` translates the current draft between supported languages, currently English and German.

Global AI behavior is managed in `/admin/ai-settings` and stored in MongoDB under the `site_content` document `_id: "ai_settings"`. That screen lets the admin choose the OpenAI model, set agent instructions, adjust temperature, and decide whether requests should include CV context. The code only contains a brief starter template used to initialize the database record for a new site owner; the active brand instructions are read from the database. The model field offers common suggestions but accepts any model id available to the configured OpenAI account. Some newer reasoning models may not support temperature; the API retries once without temperature if OpenAI rejects that parameter.

CV context is inherited from the same CV documents managed in `/admin/cv`. Each AI request reads the current global AI settings and CV download records from MongoDB and, when CV context is enabled, attaches fetchable PDF URLs as Responses API `input_file` items. This means newly uploaded CV PDFs are picked up automatically on the next AI request. Localhost-only URLs are skipped because OpenAI cannot fetch them from the API.

The AI route is server-side only, so the browser never receives the OpenAI API key. Generated HTML is sanitized before being returned to the editor and should still be reviewed before publishing.

Required environment for post media and AI features:

- `DO_SPACES_BUCKET`, `DO_SPACES_REGION`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`
- `DO_SPACES_ENDPOINT`, `DO_SPACES_PUBLIC_URL`
- `DO_SPACES_UPLOAD_PREFIX` for post media, defaulting to `portfolio-posts`
- `POST_UPLOAD_MAX_BYTES`, defaulting to 100 MB
- `OPENAI_API_KEY` for AI-assisted post editing
- `OPENAI_POSTS_MODEL`, defaulting to `gpt-5.5`

## GitHub portfolio

The portfolio section loads repository metadata from `/api/github/projects`.

- Select the visible repositories in `/admin/github-portfolio`.
- `GITHUB_USERNAME` controls the default GitHub owner before GitHub Portfolio settings are saved. It defaults to `mkrostewitz`.
- `GITHUB_PORTFOLIO_REPOS` is an optional comma-separated bootstrap list, for example `domainname.com,owner/another-repo` or full GitHub URLs.
- `GITHUB_TOKEN` is optional, but recommended for private repositories and higher GitHub API rate limits.

If no repositories are selected, the public portfolio section shows no projects.

## CV downloads

The public CV button creates a verified lead before serving a PDF. Public CV metadata is exposed through `/api/cv`, but the actual PDF is served through a tokenized `/api/cv/download` URL after email verification. The download route only streams the remote DigitalOcean Spaces URL stored in MongoDB; no CV PDF is bundled with the project.

- Upload and replace CV PDFs in `/admin/cv`.
- Files are uploaded to stable DigitalOcean Spaces paths with readable attachment filenames.
- `DO_SPACES_CV_PREFIX` controls the Spaces key prefix for CV files. It defaults to `cv`.
- `CV_UPLOAD_MAX_BYTES` controls the PDF upload limit. It defaults to 10 MB.
- Contact and CV requests are stored together in the MongoDB `leads` collection and managed from `/admin/leads`.

Secret helpers:

```bash
npm run admin:secret -- session
npm run admin:secret -- password-hash "your-password"
```

Use `passwordHash` for password plus 2FA sign-in. Magic-link sign-in only needs the admin user document with an email, mail settings, MongoDB, and `AUTH_SECRET`.
After signing in, the admin password can be set or replaced at `/admin/security` without entering the old password. The login page's forgot-password action sends a one-time reset link that opens `/admin/reset-password` and consumes the token only when the new password is saved.

Authenticator-app 2FA can be configured after sign-in at `/admin/security`. The setup screen generates a pending TOTP secret, shows a QR code and manual key, and only saves `totpSecret` to the user document after a valid authenticator code is entered. Microsoft Authenticator, Apple Passwords, 1Password, and other standard TOTP apps are supported.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
