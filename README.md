# smileCULTURE Quiz — Next.js on Vercel

The Culture quiz (felt 3D characters, Studio, Admin) as a Vercel app with Google sign-in and Google Sheets storage.

| URL | Who | |
|---|---|---|
| `/` | everyone | intro, privacy notice, Google sign-in |
| `/quiz` | signed-in users | the quiz |
| `/result` | signed-in users | own latest result |
| `/admin`, `/admin/results`, `/admin/settings` | emails in `ADMIN_EMAILS` | HR dashboard |

## How it works

- **UI**: `public/app.html` is the original quiz page, ported by `scripts/port-client.py` (its `window.claude` calls now go to the APIs below). `middleware.ts` checks the session and role **on the server** before serving it on any page route.
- **Auth**: Auth.js (next-auth v5) with Google; JWT session. `user_id` = Google account `sub`; unverified emails are rejected.
- **Admin**: `lib/access.ts` matches the session email against `ADMIN_EMAILS` (server only). Non-admins get redirected from `/admin/*` (pages) or HTTP 403 (APIs). Signed-out users get 401 / redirect to sign-in.
- **Submit** `POST /api/quiz/submit`: identity from the session only; answers validated; score recalculated on the server (`lib/scoring.ts`, tested for parity with the browser code); `attempt_id` (created when the quiz starts, reused on retries) makes the call idempotent; next `attempt_number` = user's existing attempts + 1; appends to **Attempts**, then rebuilds **Users** and **Summary** from Attempts.
- **Config** (Cultures, characters, questions, draft/live): stored in a **Config** tab (auto-created).

### Sheets structure (tabs are created automatically)

- **Attempts** — one row per completed attempt: `submission_id, attempt_id, user_id, email, display_name, attempt_number, started_at, completed_at, duration_seconds, total_score, maximum_score, main_result, secondary_result, answers_json, result_json, quiz_version, status, created_at`. This is the source of truth.
- **Users** — one row per user: `user_id, email, display_name, first_attempt_at, latest_attempt_at, total_attempts, latest_result, latest_score, highest_score` (rebuilt on every submit).
- **Summary** — totals, unique/repeat users, repeat %, avg attempts/user, avg score, most common result, attempts per day / per Culture / per email (rebuilt on every submit).
- **Config** — app settings (do not edit by hand).

To remove a person's result, delete their rows in **Attempts**; Users/Summary refresh on the next submit (and the dashboard reads Attempts directly).

## 1. Google Cloud setup

1. Go to <https://console.cloud.google.com>, create (or pick) a project.
2. **APIs & Services → Library →** enable **Google Sheets API**.
3. **IAM & Admin → Service Accounts → Create service account** (no roles needed). Open it → **Keys → Add key → JSON**. From the downloaded file copy `client_email` → `GOOGLE_SHEETS_CLIENT_EMAIL` and `private_key` → `GOOGLE_SHEETS_PRIVATE_KEY` (keep the `\n` escapes; the server turns them into line breaks). Delete the JSON file afterwards; never commit it.
4. **APIs & Services → OAuth consent screen**: user type *Internal* (Google Workspace, only your domain can sign in) or *External*; scopes `openid email profile` only.
5. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://<your-project>.vercel.app` and `http://localhost:3000`
   - Authorized redirect URIs: `https://<your-project>.vercel.app/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`
   - Copy the client ID/secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
   - Google does not accept wildcard redirect URIs. For Preview, add a fixed branch URL (e.g. `https://<project>-git-staging-<team>.vercel.app/api/auth/callback/google`) or use a second OAuth client for Preview.

## 2. Google Sheets setup

1. Create **two** spreadsheets: `smileCULTURE – Production` and `smileCULTURE – Test`.
2. Share each with the service-account email as **Editor**.
3. Copy each ID from the URL `https://docs.google.com/spreadsheets/d/<ID>/edit`.
4. Nothing else — the app creates the Attempts / Users / Summary / Config tabs and header rows on first use.

## 3. Local development

```bash
npm install
cp .env.example .env.local   # fill in, using the TEST spreadsheet
npm run dev                  # http://localhost:3000
npm test                     # scoring parity, attempt counting, access rules, preview guard
```

## 4. Vercel deployment

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket). `.env*` is git-ignored.
2. Vercel → **Add New Project** → import the repo (framework: Next.js; defaults are fine).
3. **Settings → Environment Variables** — set per environment:

   | Variable | Production | Preview |
   |---|---|---|
   | `AUTH_SECRET` | secret A | secret B |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | prod client | prod or preview client |
   | `ADMIN_EMAILS` | HR admins | testers |
   | `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` | service account | service account (or a separate one) |
   | `GOOGLE_SHEETS_SPREADSHEET_ID` | **Production** sheet ID | **Test** sheet ID |
   | `PRODUCTION_SPREADSHEET_ID` | Production sheet ID | Production sheet ID |
   | `ANTHROPIC_API_KEY` (optional) | key | key or empty |

   `PRODUCTION_SPREADSHEET_ID` is a guard: a Preview/Development deployment pointing at the production sheet refuses to write. For full separation also give Preview a separate service account that is not shared on the production sheet.
4. Deploy. Production URL: `https://<your-project>.vercel.app`. Add it to the OAuth client (step 1.5) and redeploy if you changed variables.
5. Pushes to non-production branches create Preview deployments automatically.
6. Open `/admin` → **ตั้งค่าและการแชร์ → Share Links** to copy the employee (`/quiz`) and admin (`/admin`) links.

## Updating the characters after a Studio sync

The quiz artifact is still the design source. After syncing the Studio into the artifact:

```bash
python3 scripts/port-client.py <path-to-artifact-index.html> public/app.html
npm test && npm run build
```

`port-client.py` stops with `PORT FAILED` if the artifact changed where a patch applies; fix the matching `R(...)` line.

## Security checks

```bash
npm run build && npm run check:bundle   # fails if a secret name/value appears in browser files
```

Run `check:bundle` with the real env loaded to also scan for the secret values.
