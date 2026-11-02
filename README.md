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
- To publish posts from `/admin/posts`, add the `Share on LinkedIn` product to the LinkedIn app. The admin publishing connect action requests `w_member_social`, adds `w_organization_social` when a LinkedIn organization is configured, and stores the access token encrypted in MongoDB.
- To publish to a managed LinkedIn Page, configure `LINKEDIN_ORGANIZATION_URN` with either `urn:li:organization:<id>` or the numeric organization ID. `LINKEDIN_COMPANY_PAGE_URN`, `LINKEDIN_COMPANY_ORGANIZATION_URN`, `LINKEDIN_ORGANIZATION_ID`, and `LINKEDIN_COMPANY_PAGE_ID` are accepted aliases. `LINKEDIN_ORGANIZATION_NAME` or `LINKEDIN_COMPANY_PAGE_NAME` can be set for the admin label.
- Company page publishing requires LinkedIn app access for `w_organization_social`, and the connected LinkedIn member must have an approved Page role that can publish. After setting the organization env value and getting LinkedIn app access, reconnect LinkedIn from `/admin/posts` so the OAuth token includes `w_organization_social`.
- When sharing a post, the admin can choose a saved site language, choose the connected member profile or configured company page, add optional LinkedIn commentary, include a supported attached image, and either share immediately or schedule the share. Post image uploads are limited to JPG, PNG, and GIF so attached images can be used by LinkedIn image publishing.
- Scheduled shares are optional. Set `LINKEDIN_SCHEDULER_ENABLED=true` and set the same random `LINKEDIN_SCHEDULER_SECRET` value in Netlify and your environment file to turn them on. Netlify must have these values in Site configuration > Environment variables, followed by a production redeploy; `.env.online` is only a local reference file.
- When enabled, scheduled shares are processed by the Netlify scheduled function in `netlify/functions/linkedin-scheduler.mjs`, with its cron expression configured in `netlify.toml` under `[functions."linkedin-scheduler"]`. Netlify runs scheduled functions on UTC cron for published deploys only, and the function checks for due jobs every minute by calling `/api/admin/linkedin/scheduled`.
- Netlify scheduled functions have a 30 second execution limit and do not return response bodies. The scheduler logs the API result and processes one due job per run by default; set `LINKEDIN_SCHEDULER_BATCH_LIMIT` from `1` to `5` only if scheduled publishing remains comfortably under the Netlify limit. The admin LinkedIn panel shows the last recorded scheduler check; if it says no checks were recorded, Netlify has not invoked the scheduled function on the deployed site yet.
- `LINKEDIN_OAUTH_SCOPES` is optional and defaults to `openid profile email` for admin sign-in. `LINKEDIN_API_VERSION` is optional and defaults to `202605` for the LinkedIn Posts API. `LINKEDIN_REQUEST_TIMEOUT_MS` is optional and defaults to `20000`.

## Language detection

The public site calls `/api/language` on first load unless the visitor has manually selected a language. The route first reads platform country headers derived from the visitor IP, such as `x-vercel-ip-country`, `cf-ipcountry`, and `cloudfront-viewer-country`. If those are unavailable, it uses `IPGEOLOCATION_API_KEY` with IPGeolocation.io to read the visitor country code from a forwarded public IP. German is shown for `AT`, `CH`, `DE`, `LI`, and `LU`; English is used for every other country or when detection is unavailable. Lead tracking uses the same provider as a fallback when platform headers do not include country, region, city, latitude, or longitude.

## Privacy consent

The public consent preference is stored in browser local storage. `NEXT_PUBLIC_CONSENT_STORAGE_KEY` can override the storage key; it defaults to `site-consent-preferences`.

## Weather data

The sailing weather panel does not call Open-Meteo directly from the browser. Production requests use the Netlify Function at `/.netlify/functions/weather`; local Next development falls back to `/api/weather`. Both endpoints share the same server-side fetcher, normalize the Open-Meteo response, and cache successful responses for 60 seconds with stale revalidation headers. At steady traffic this is about 1,440 Open-Meteo calls per day. Set `OPEN_METEO_API_KEY` to use Open-Meteo's customer endpoint; without it, the free endpoint is used.

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

## Apollo lead email enrichment

In **Admin → Leads**, new and existing lead forms include **Enrich contact**. Enter a LinkedIn personal profile URL, or a first name, last name and company. The lookup sends these identity fields to Apollo's [People Enrichment API](https://docs.apollo.io/reference/people-enrichment). Review the matched person, match confidence and email status, then choose **Use this email** (or **Replace email with Apollo result**) and save the lead. Changing the identity clears the lookup result. Existing emails are only replaced when you apply the result.

Apollo is optional and **disabled by default**. Configure it under **Admin → Integrations → Apollo contact enrichment**: enter a key, switch on enrichment, and save. Lead forms show a disabled Enrich contact button with an Integrations setup link while Apollo is disabled or unconfigured; the server rejects lookups while disabled. Other lead and AI features do not require Apollo.

The key needs access to `api/v1/people/match`. Saved settings live in `site_content`, document `_id: "apollo_settings"`; keys use AES-256-GCM encryption with the server's `AUTH_SECRET` (at least 32 characters). Keep that secret stable or replace the saved Apollo key after rotating it. Settings responses expose only configuration status, never the key. A blank key field preserves the saved key; the removal checkbox explicitly deletes it and disables the integration. Apollo credentials are configured only through Integrations and stored encrypted in the database; there is no environment-key fallback. The endpoint `/api/admin/leads/enrich` requires an authenticated admin and a same-origin POST.

Lookups may consume Apollo credits even when a person is matched without an email. By default this integration requests work emails with personal email reveal, phone reveal and waterfall enrichment disabled. Select Include phone number on a lead to request direct/mobile numbers with additional credits; native polling retrieves results without a webhook. A match does not guarantee an email; unavailable or masked addresses are never filled in. Apollo's email status is displayed for review and does not mark an inbound lead as email-verified. Email lookups alone do not send emails or create Apollo contacts.

Run the mocked integration checks with `node --test src/app/lib/apolloEnrichment.test.mjs`.

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
- **Add new lead** creates a personal outreach lead with just a name; company, role, LinkedIn profile, email, phone, website, and a contact-details source URL are optional.
- Open a lead to find them on LinkedIn, open their saved profile, research contact details, or compose an email. Use **Add activity** to record phone calls, LinkedIn messages or connection requests, emails, meetings, and notes in a separate modal with the actual date. Opening a link does not record or send outreach.
- Follow-up suggestions use five calendar days after the latest activity, including when backdating an entry. Change or clear that date and record the next step. The lead list shows due/overdue counts, follow-up filters, and earliest follow-ups first. Won/lost leads have their reminders cleared. These are in-app reminders; no reminder emails or automated LinkedIn actions are sent.
- The optional address block stores street, building number, address line 2, postal code, city, region, country, and country code separately. Address suggestions appear automatically after typing at least three characters, using the existing `NEXT_PUBLIC_MAPBOX_TOKEN`. Choose a dropdown result with the mouse or arrow keys and Enter, then review and save. Requests are debounced and outdated searches cancelled. Manual entry and partial addresses are supported. Search uses [Mapbox permanent geocoding](https://docs.mapbox.com/api/search/geocoding/#storing-geocoding-results) so selected results and coordinates can be stored; the account must support permanent geocoding. Changing address fields drops previous coordinates and automatically geocodes the new address. Search selections update the map immediately; manual edits update it after a short pause. Saving waits for the lookup and stores resolved coordinates; clearing removes the saved address. Older free-text locations remain available until replaced.
- **Inbound lead details** appears at the top of inbound lead forms. A contact map uses the saved contact address/city or the approximate inbound request location; the map previews address edits before saving.
- Lead details scroll above a persistent footer with **Save changes**, **Cancel**, and **Delete lead**. Deleting requires confirmation and permanently removes the lead, its activities, and its follow-up reminder.
- Existing notes and inbound verification/download details remain available. Contacts and activity are saved in the existing `leads` collection; automatic contact enrichment is not enabled.
- **Import Excel** accepts `.xlsx` files using the Leads.xlsx columns (Firma, Ansprechpartner, Status, Datum, Tool, Nachverfolgung) on the first worksheet. Review the automatically split names, select contacts, and check duplicates before importing. Exact normalized name/company, email, or LinkedIn matches are skipped without changing existing records. Dated statuses become activities, and missing follow-up dates suggest five days after the activity. Files are limited to 5 MB and 500 contacts per import.
- Run outreach validation tests with `node --test src/app/lib/leadOutreach.test.mjs src/app/lib/leadAddress.test.mjs src/app/lib/leadImport.test.mjs`.

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

## Article newsletter

Confirmation and article emails use the shared branded email template. The confirmation page uses the public navigation and footer.

Admin → Subscribers includes a searchable list and a map of approximate signup locations. Configure `IPGEOLOCATION_API_KEY` for server-side signup lookups and `NEXT_PUBLIC_MAPBOX_TOKEN` for the admin map. Lookups run after signup validation and throttling; provider failures do not block confirmation emails. Subscriber records store city, region, country, and coordinates, but no raw IP address. Confirmation retries the location lookup if signup did not capture coordinates. Already confirmed subscribers without location data remain unknown because raw IPs are not retained. Localhost and private IP requests cannot be geolocated. The map follows the list filters across all pages, capped at the newest 2,000 located subscribers.

Visitors can subscribe from the homepage blog section or an article page, in English or German. An explicit checkbox and a confirmation email are required; confirmation links expire after 24 hours. Opening an email link does not change a subscription until the visitor presses the confirmation or unsubscribe button, so email link scanners do not activate subscriptions or unsubscribe readers.

Setup before enabling this in production:

1. Configure and test SMTP in `/admin/mail-calendar` (the existing environment SMTP settings also work).
2. Newsletter links use the current request origin, including the protocol and port, just like login, contact, and CV emails. A signup on `http://localhost:3001` receives confirmation links on that host. Article and unsubscribe links use the origin of the authenticated scheduler request. The Netlify scheduler prefers `DEPLOY_PRIME_URL`, then `URL` and `DEPLOY_URL`, before configured site URLs. Set `NEXT_PUBLIC_SITE_URL` (or `AUTH_BASE_URL`) as a fallback for calls without a request origin. Relative email logo URLs use the same origin as the email links.
3. Set `NEWSLETTER_SCHEDULER_SECRET` to a long random secret in the deployment environment and redeploy. The included Netlify `newsletter-scheduler` runs every minute and calls the authenticated `/api/admin/newsletter/scheduled` endpoint. For other hosts, schedule a POST to that endpoint with `Authorization: Bearer <secret>` once per minute. Never expose this secret to client code.

The first publication atomically queues notifications in the post's `newsletter` field. Saving edits, changing the publication date, or archiving and republishing does not create a new campaign. Previously published articles are not backfilled. Only subscribers confirmed before that first publication receive the announcement. A custom publication date remains display metadata, as in the existing editor; it does not schedule publication. Hidden blogs and unpublished posts pause delivery.

Each scheduler call sends to one subscriber, individually, using the saved language and existing post translation fallback. This conservative rate (up to 60 messages/hour) is intended for a small personal newsletter. Failed deliveries retry after five minutes, up to five attempts, then record a failure and continue. Disabled or unconfigured SMTP pauses processing. MongoDB stores progress and a five-minute worker lease to prevent overlapping runs. SMTP cannot guarantee exactly-once delivery: a process crash after SMTP accepts a message but before progress is saved can cause a duplicate on retry.

Operational records:

- `newsletter_subscribers`: email, language, consent version, confirmation dates, hashed confirmation token, and unsubscribe token. Unconfirmed subscriptions expire after 24 hours; unsubscribed records after 30 days, using MongoDB TTL indexes.
- `newsletter_rate_limits`: hashed network identifiers and hourly request counts, automatically expiring after two hours. Netlify's trusted connection IP header is preferred; deployments behind other proxies should provide a trusted `x-real-ip` header. Requests without either share a fallback limit.
- `posts.newsletter`: campaign cursor, sent count, retry count, next available time, and completion date.
- `newsletter_failures`: post/subscriber IDs for recipients skipped after five failed attempts; inspect these and the Netlify function logs to investigate delivery failures. SMTP acceptance does not guarantee inbox placement; bounce processing is not included.

For local testing, use a separate MongoDB database and an SMTP test inbox. Subscribe, confirm, publish a draft, and call the scheduler endpoint with the configured secret. Verify a second call does not repeat delivery, ordinary post edits do not restart a campaign, and unsubscribed addresses receive no subsequent announcements. Automated delivery checks: `node --test src/app/lib/newsletterCore.test.mjs`.

### Editable CV timeline

Manage career entries under **Admin → CV → CV timeline** (`/admin/cv`). Stations appear as compact timeline cards with date badges; select a card to open its editor. English/German tabs contain the period, title, location, role description, and achievements. **Translate to…** uses the configured AI model and `OPENAI_API_KEY` to draft every field in the target language, asks before replacing existing translations, and leaves the result unsaved for review. You can also add, remove, and reorder stations. Click **Save timeline** to publish. PDF uploads remain separate.

The MongoDB collection is **`cv_timeline`** in the database selected by `MONGO_DB_NAME`. **Each career entry is its own document** with a stable `_id`, numeric `order` (ascending display order), `translations.en` / `translations.de`, `createdAt`, `updatedAt`, and `updatedBy`. There is no wrapper document or entries array. Initialization and editor revision metadata live separately in `site_content`, document `_id: "cv_timeline_settings"`.

Run `npm run migrate:cv-timeline` with the target database's usual `MONGO_DB_URI`, `MONGO_DB_NAME`, `MONGO_DB_USER`, and `MONGO_DB_PASSWORD` configuration. The script loads Next.js environment files. It splits the earlier `_id: "timeline"` wrapper into individual documents, preserving edits, order, languages, and audit fields, then removes the wrapper. Retrying migration preserves existing entry documents. First access also runs this initialization automatically. New databases seed from `site_content` → `translations` when available, otherwise the bundled translations.

To move your edited timeline to production, export/import the **`cv_timeline` collection**, preserving document IDs and `order`, alongside deploying this code. Replace the target collection rather than merging it, so removed entries stay removed. Also migrate the `site_content` document `_id: "cv_timeline_settings"` to preserve revision and initialization state (required for an intentionally empty timeline). Import before serving traffic. PDF metadata remains in its existing storage. Saves update individual documents; multi-entry changes are not a MongoDB transaction.

Public timeline requests bypass caching, so saved changes appear on the next page load. Bundled/legacy translations remain an outage fallback. No server restart or rebuild is needed for timeline edits.

### Optional Apollo list and sequence actions

In **Admin → Integrations**, enable **Add to an Apollo list**, choose an existing contact list or create one, and save settings. List creation immediately creates an empty list in Apollo; saving settings selects the destination. In a lead form, apply the enriched email (or enter an existing email), open **Add to Apollo**, and click **Add to [list name]**. Existing configurations without a list ID retain the legacy `website_leads` destination until a list is selected. Selected lists are resolved by ID before sending, so renamed lists still work and deleted lists require reselection. Save the lead first. The action saves current contact details and tags locally, sends name, company, email, phone, job title, website, location and LinkedIn URL, and persists the Apollo contact ID. Existing contacts are updated by ID; later email changes retain that link. Saving a linked lead queues an automatic update; enrichment alone does not send changes.

To allow enrollment, enable **Allow optional sequence enrollment** and choose an existing Apollo sequence and connected sending email account from the dropdowns. Save your API key before enabling sequence enrollment. Options load using the encrypted saved key, including while enrichment is disabled; Refresh reloads them and Load more sequences fetches subsequent pages. In each lead form, explicitly select **Also enroll this contact** before sending. This may initiate emails according to the sequence's status and schedule. Apollo's default verification, ownership and existing-sequence restrictions remain enabled. Already-enrolled contacts are reported without restarting their sequence. Partial results distinguish list membership from enrollment; after a timeout or unconfirmed response, check Apollo before retrying. This is an on-demand admin action, not an automatic public-form signup workflow.

Additional key permissions: `api/v1/labels/index` to browse lists, `api/v1/labels/create` to create lists, `api/v1/contacts/bulk_create`, `api/v1/contacts/update`, `api/v1/labels/add_entity_ids_to_label_names`, and (only for enrollment) `api/v1/emailer_campaigns/add_contact_ids`. Settings are saved in the existing encrypted-credential integration; both new actions default to disabled. Sequence templates and sender accounts are managed in Apollo.

The sequence and sender dropdowns additionally require `api/v1/emailer_campaigns/search` and `api/v1/email_accounts/index`. The admin-only options endpoint returns only IDs, display labels and availability status; mailbox credentials and signatures are never returned to the browser. Saved selections remain intact during lookup errors.

Phone enrichment additionally requires `api/v1/webhook_result/show`. The form polls for up to five minutes, respecting Apollo’s retry delay; Check again retrieves the existing lookup without requesting a new paid enrichment. Closing the form or changing identity stops polling. Phone numbers are reviewed and applied separately, never automatically replacing a saved phone. Save the lead to persist the selected number.

### Background Apollo updates

Saving an already linked lead records its changes and a pending sync in MongoDB together, then responds immediately. Next.js `after()` starts the sync after the save response. A Netlify scheduler runs every minute to pick up due retries and interrupted jobs; it uses a scoped HMAC derived from the existing `AUTH_SECRET`, with no additional secret to configure. On other hosts, POST `/api/admin/leads/apollo/scheduled` once per minute with `Authorization: Bearer <apolloSchedulerToken(AUTH_SECRET)>` (helper in `src/app/lib/apolloSyncQueue.mjs`). Local development also processes due work while the lead form polls its sync status.

The worker locks one lead, uses its stored Apollo contact ID, and never enrolls it in a sequence. Saves during a sync remain queued. Network errors, timeouts, HTTP 429 and server errors retry with backoff, up to five attempts; permission and validation errors require correction. List/tag assignment has a 30-second timeout. The form displays pending, retrying, synced or failed status without blocking local saves. Initial Add to Apollo and explicit sequence enrollment remain interactive; ambiguous creation or enrollment is never automatically replayed. Failed jobs can be retried by saving the linked lead again.

### Apollo category rules

Outreach uses the lead form’s Contact type (`leadTypes`) as categories. The server creates or reuses the custom contact field **Contact Type** and syncs all tags as semicolon-separated text (for example `Recruiter; Interim Firm`). Changes replace the full value, including clearing it when all tags are removed. Only the selected destination list is assigned; old category-list memberships are left intact. In Apollo, combine the `website_leads` list filter with **Custom fields → Contact Type → Contains → Recruiter** to select prospects for a sequence. Add Contact Type as a table column to review it. Field setup uses the same fields/index and fields/create permissions as Website Source.

Under Integrations, choose one sending account and map categories (for example Recruiter, Interim Firm, Manufacturer) to existing Apollo sequences. Reorder rules using the arrow buttons: the first matching category wins and only one sequence is selected. The existing sequence setting becomes the optional fallback. Without a matching rule or fallback, list/label addition still works but enrollment is unavailable. The lead form previews the selected sequence; enrollment remains an explicit per-contact choice. Server-side routing uses saved settings and the submitted form tags, so unsaved tag edits are included in this action. The Add to Apollo action also persists those contact and tag edits locally.

The category sequence editor displays a separate dropdown for every known category, combining the category catalog, current/legacy lead tags and saved rules. Assignments are independent; unassigned rows are not saved as rules. Clearing one category leaves other category sequences unchanged.

### Reusable Material UI admin forms

Apollo Integrations is the first Material UI form. `admin/components/forms/AdminMuiProvider.jsx` supplies Next.js App Router style caching and a theme synchronized with the existing light/dark toggle, without a global CSS reset. Wrap new Material UI admin forms in this provider.

`admin/components/forms/FormFields.jsx` provides `FormField`, searchable `FormSelect`, `FormToggle`, `FormButton`, and labeled `FormIconButton`. `FormScope` propagates disabled state through nested controls and portaled dialogs. Required selectors validate a selected option rather than arbitrary search text. Apollo list creation uses a dialog with its own submit handler; it selects the created list while leaving the parent settings save explicit.

### Lead Source for Apollo personalization

The lead form’s Contact details section includes **Contact type** and a single-value **Source** autocomplete. Type a new source or select a previously saved choice. Saving/Create lead and Add to Apollo remember choices in `lead_sources` (case-insensitive), persist the selected value as `contact.source`, and queue updates for linked contacts. Clearing a value clears the Apollo custom field; it does not delete the shared suggestion. This is separate from the lead’s inbound/manual source metadata and the optional source URL.

Apollo reserves **Source** as a read-only system field, so the integration uses a single-line custom contact field named **Website Source**. It discovers or creates that field, caches its ID in Apollo integration settings, and sends values via `typed_custom_fields` before sequence enrollment. Field setup requires `api/v1/fields/index` and `api/v1/fields/create`; contact updates require `api/v1/contacts/update`. Replacing the API key resets the field mapping for the new workspace.

In Apollo, add **Website Source** as a contact column. In a sequence email, write “I found you through ” and insert **Website Source** from the `{ }` custom-variable menu. Preview with a contact that has a saved source. Use Apollo’s advanced conditional fallback if you want “LinkedIn” when the source is empty; `{{Source/LinkedIn}}` is not the field token generated by this integration. Do not infer sources for existing leads automatically.

### Company details and Apollo sequence variables

The standalone **Company Details** card expands to show Products, Applications, website, source link and address. Products and Applications accept multiple reusable values. Products share the existing research selections; saving research does not erase manually entered applications. Both catalogs persist choices for later leads.

Apollo custom contact fields **Company Products** and **Company Applications** hold comma-separated values. Linked lead saves sync changes in the background, including clearing removed values. Add to Apollo verifies these custom field values before optional sequence enrollment. Old records without these properties do not clear Apollo values. Field mappings are cached alongside Source and Contact Type and reset when the API key changes.

In Apollo’s sequence editor, use the `{ }` custom-variable menu to insert **Company Products** or **Company Applications** and preview against a populated contact. These are contact fields even though they describe the company, so each lead can have relevant product/application selections.

### Leads Material UI

The entire leads workspace uses the shared `AdminMuiProvider` theme. Tables, filters, multivalue and single-value autocomplete, form controls, expandable cards, create/edit/import/delete/activity dialogs, alerts and notifications use Material UI. The Mapbox map retains its mapping controls. `LeadUi.jsx` provides shared controls and disabled-state context so controls rendered in portals respect saving state. Dialog focus trapping, Escape/backdrop dismissal and scroll locking are managed by MUI; the lead form’s actions are portaled into fixed dialog footers. CSS modules retain layout and research/map presentation styles.

### Required lead fields

Open **Leads → Required fields** to select mandatory contact and company information. Local defaults require salutation, first name, company, street, city, country, lead source, and contact type; email is optional locally. Apollo-only defaults require email and company. Products and Applications can also be required when used in sequence variables. A contact name remains a base requirement even if every configurable field is disabled.

The configuration is stored in `site_content/lead_settings`. Admin create/update, import preview/commit, and the shared Apollo sender enforce it on the server; the form shows missing fields and import review exposes the selected requirements. Existing and inbound public-form leads remain visible without a migration, but must be completed before admin saving or Apollo sync/enrollment. Background jobs fail without retry when required information is missing; completing and saving a linked lead queues a new sync. These checks do not stop sequences already running or actions performed directly in Apollo.

### Managing sequence membership

In a lead’s **Apollo sync & sequences** card, each current sequence has **Pause future emails**, **Remove from sequence**, and **Move to selected sequence** actions. Choose a destination in Selected sequence, then use Move on the old sequence. The confirmation names both sequences. Moves use saved lead details; save edits first. Pause uses Apollo’s contact-specific `stop` mode and verifies a paused/stopped membership. Resume is available directly in Apollo. Already sent emails cannot be recalled.

These actions require `api/v1/emailer_campaigns/remove_or_stop_contact_ids` plus contact/progress read permissions. They use the linked contact ID and the same lease as sync/enrollment. Pause/remove bypass mandatory-field validation so incomplete data never prevents stopping outreach. Move validates and syncs details before removal, verifies the old membership is removed, then enrolls in the destination. An unconfirmed removal blocks enrollment; failed destination enrollment is reported as partial completion without automatically restarting the old sequence. Actions are never retried automatically. Other memberships and the contact’s list membership are preserved.

### Contact types, sources, and default sequences

Use **Contact types & sources** on Leads or in Apollo Integrations to create reusable choices without creating a contact. Names are saved immediately in the existing case-insensitive `leadTypes` / `lead_sources` catalogs and become available in lead autocompletes. In Apollo Integrations, assign **Sequence per source** and **Sequence per contact type**, then click **Save settings** to persist the rules.

Default routing priority is explicit sequence choice, matching Source, first matching contact-type rule, then fallback. Source matches use the contact’s editable Source value (Apollo Website Source), not the inbound/manual metadata. Source rules are stored separately as `sourceSequenceRules`; existing contact-type rules remain compatible. Adding choices or changing defaults does not enroll contacts or move existing memberships automatically.

### Salutation

Lead Contact details includes a **Salutation** autocomplete (Mr., Ms., Mrs., Mx., Dr., Prof., Prof. Dr., or a custom title). It is stored separately as `contact.salutation`, required by default, and included in import review and server-side lead guards. Existing required-field configurations gain this default once; saving Required fields records the explicit configuration so it can subsequently be deselected. Existing contacts are not assigned an inferred title.

Apollo sync discovers or creates a custom contact field named **Salutation**, sends the chosen title, and verifies it before enrollment. Select Salutation from Apollo’s custom-variable picker for sequence personalization. Clearing an explicitly supplied value clears the custom field if the requirement is disabled; legacy updates that omit salutation preserve it. The field is provisioned on the next eligible contact sync.


### Separate local and Apollo requirements

**Leads → Required fields** has two checkbox columns: **Save lead** and **Apollo sync**. Local create/update and import enforce only Save lead requirements. Apollo manual sync, background sync, enrollment, and sequence moves enforce the union of both columns. Pause and remove remain available without complete contact data. The lead form’s asterisks indicate local requirements; the Apollo card lists any missing Apollo requirements separately.

When upgrading existing settings, email becomes optional locally while the previous requirements are preserved in the Apollo column. Saving the new settings records the split explicitly, including empty selections. Administrators may subsequently require email locally again or disable the Apollo-only email requirement. Email sequence enrollment always needs an email; moves check that before removing the old membership. If email is optional for sync, an empty local email does not overwrite a known Apollo email. Email-less creation links only an unambiguous returned identity; otherwise it asks for review in Apollo.


Contact type now accepts one value per lead. The autocomplete replaces the current choice; import review uses the same control. Existing leads with multiple distinct types retain their stored values and display a warning until one is selected. Local save/import and Apollo sync guards reject unresolved multiple types. The `leadTypes` array is retained for storage compatibility, with zero or one value on new saves. Contact-type list filters can still select multiple types to find leads across categories.
