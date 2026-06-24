# Deploying Tracewave

The dashboard is a Next.js app and deploys to **Vercel** in a couple of minutes. The backend
(FastAPI + the firehose) is optional for a public demo — without it, the frontend runs its
in-browser demo stream automatically, so the link is alive on its own.

There are two deploy stories. Pick one.

---

## Story A — Frontend only (demo stream) · recommended for the portfolio link

Nothing to provision. The dashboard detects there's no backend and runs the labelled `DEMO`
simulation. This is the fastest way to a live, shareable URL.

### 1. Push to GitHub
Make sure the repo is on GitHub (e.g. `github.com/charanreddy-27/tracewave`).

### 2. Import into Vercel
1. [vercel.com/new](https://vercel.com/new) → **Import** your repo.
2. **Root Directory:** set it to the folder that contains the Next.js app — **`frontend`**
   (or `tracewave/frontend` if you pushed the parent folder). This is the one setting people miss.
3. **Framework Preset:** Next.js (auto-detected).
4. **Build & Output:** leave defaults (`next build`; Vercel handles the rest — the `output:
   "standalone"` line in `next.config.mjs` is only used by the Docker image and is harmless here).

### 3. Environment variables
| Variable | Value | Needed? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` (or your custom domain) | Recommended — makes OG/Twitter cards use absolute URLs |

> Leave `NEXT_PUBLIC_WS_URL` and `BACKEND_ORIGIN` **unset** for the demo-only deploy.

### 4. Deploy
Hit **Deploy**. In ~60s you'll have a URL that opens straight into a live (simulated) dashboard.

---

## Story B — Full stack (real live feed)

Run the API somewhere that can hold a WebSocket open (Vercel can't), then point the frontend at it.

### 1. Backend → Fly.io / Render / Railway
- Deploy the `backend/` image (a `Dockerfile` is provided).
- Provision managed **Redis** and **TimescaleDB** (or Postgres + the Timescale extension).
- Set backend env (`TW_` prefix):

  | Variable | Value |
  |---|---|
  | `TW_USER_AGENT` | a descriptive UA with your contact (Wikimedia 403s generic clients) |
  | `TW_REDIS_URL` | your managed Redis URL |
  | `TW_PG_DSN` | your TimescaleDB DSN |

- Keep at least one detector + one metric always running so the live link is never empty.

### 2. Frontend → Vercel (same as Story A) plus:
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_WS_URL` | `wss://your-api-host/ws` |
| `BACKEND_ORIGIN` | `https://your-api-host` (for the `/api/*` REST proxy / incident replay) |
| `NEXT_PUBLIC_SITE_URL` | your public dashboard URL |

With `NEXT_PUBLIC_WS_URL` set and reachable, the frontend uses the real feed and never shows the
demo badge.

### 3. Custom domain (optional)
Vercel → Project → **Settings → Domains** → add e.g. `tracewave.charanreddy.dev` and follow the DNS
instructions (a `CNAME` to `cname.vercel-dns.com`). Update `NEXT_PUBLIC_SITE_URL` to match.

---

## ✅ Manual checklist — the things only you can do

- [ ] **Push the repo to GitHub** (with the real repo name; the README/site links assume
      `github.com/charanreddy-27/tracewave`).
- [ ] **Import to Vercel** and set **Root Directory** to `frontend`.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** to the deployed URL (so social cards resolve).
- [ ] After the first deploy, **update `lib/site.ts` → `site.url`** default (and `metadataBase`) if
      you use a custom domain, then redeploy.
- [ ] **Record `docs/dashboard.gif`** with the stack running and drop it in — the README references it.
- [ ] **Confirm contact details** in `frontend/lib/site.ts` (email, Cal.com, portfolio, socials) and
      point the **Resume** button at a real résumé link if you have one.
- [ ] (Story B) **Provision Redis + TimescaleDB**, deploy the backend, and set `NEXT_PUBLIC_WS_URL` /
      `BACKEND_ORIGIN`.
- [ ] (Story B) **Set `TW_USER_AGENT`** to your contact so Wikimedia doesn't 403 you.
- [ ] **Write the LinkedIn post** and paste its URL into `frontend/lib/site.ts → site.linkedinPost`
      (the `/about-project` page shows a placeholder until you do).
- [ ] **Share it.** Post the live link; the OG card and favicon are already wired.

---

## Verify locally before you ship

```bash
cd frontend
npm install
npm run typecheck      # tsc, no errors
npm run build          # production build, all routes compile
npm run dev            # http://localhost:3000 — with no backend you'll see the DEMO stream
```
