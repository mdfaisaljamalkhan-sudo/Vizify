# Vizify — Deployment Guide (Phase 1)

Track A of the plan is done in code. This file is the runbook for the manual steps only you can do (account-owning, secret-holding steps).

## Prerequisites

- A GitHub account with this repo pushed as a remote.
- An Anthropic API key (you already have one with ~$5 credit).
- Accounts on: [Render](https://render.com), [Cloudflare](https://dash.cloudflare.com), [cron-job.org](https://cron-job.org).

## 1. Push to GitHub

If the repo isn't already on GitHub:

```bash
# From the repo root
git add .
git commit -m "Phase 1 deployment prep"
# Create an empty repo on github.com first, then:
git remote add origin https://github.com/<you>/vizify.git
git push -u origin master
```

## 2. Deploy backend to Render

1. Render dashboard → **New → Blueprint**.
2. Connect your GitHub repo. Render will detect [render.yaml](render.yaml) at the root and create the `vizify-api` web service.
3. Before clicking Deploy, set these env vars (the ones marked `sync: false` in `render.yaml`):
   - `ANTHROPIC_API_KEY` = your key
   - `FRONTEND_ORIGIN` = leave blank for now; fill in after step 3.
4. Deploy. First build takes ~5 min (Docker image, Python deps).
5. Once live, note the URL, e.g. `https://vizify-api.onrender.com`.
6. Hit `https://<url>/api/health` — should return `{"status": "ok", ...}`.

## 3. Deploy frontend to Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the repo.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `frontend`
4. Environment variables:
   - `VITE_API_URL` = `https://vizify-api.onrender.com` (from step 2.5)
5. Save and deploy. Build takes ~2 min.
6. Note the URL, e.g. `https://vizify.pages.dev`.

## 4. Wire them together

1. Go back to Render → `vizify-api` → **Environment**.
2. Set `FRONTEND_ORIGIN` = `https://vizify.pages.dev` (no trailing slash).
3. Save. Render auto-restarts.

## 5. Keep Render awake

Render free tier sleeps after 15 min idle (~30 s cold start).

1. [cron-job.org](https://cron-job.org) → **Create cronjob**.
2. URL: `https://vizify-api.onrender.com/api/health`
3. Schedule: every 10 minutes.
4. Save. Free forever.

## 6. Smoke test

- Visit the Pages URL.
- Register, upload a CSV, generate a dashboard.
- Open Chat, ask a question.
- If chat/analyze fail, check Render logs for `ANTHROPIC_API_KEY`-related errors.

## Cost watch

- Hosting: **$0/mo** on free tiers (see §8.1 of the plan).
- LLM: metered against your $5 Anthropic credit. Haiku is the default — roughly $0.005/edit, $0.008/analyze. See §8.3.
- When $5 runs out, either top up or wire the Groq/Gemini fallback (Track A step 3 — deferred for now).

## Phase 2 migration (when real users arrive)

1. Supabase → new project → copy Postgres connection string.
2. Render → set `DATABASE_URL=postgresql+asyncpg://...` and remove the SQLite disk.
3. Alembic migrations (not yet wired — will add in Phase 2).
4. Cloudflare R2 for uploads (swap the upload router path).
5. E2B for sandboxed code execution (swap `SANDBOX_MODE=e2b`).

No frontend changes needed for any of this.
