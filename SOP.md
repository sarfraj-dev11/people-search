# SOP — people-search: Zero-Cost Operations Runbook

**Document purpose:** Standard operating procedure for running, deploying, and
maintaining the `people-search` application with **$0 recurring cost**. Every
component below is either free-and-keyless, free-tier, or self-hosted.

**Repository:** `https://github.com/sarfraj-dev11/people-search`
**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · better-sqlite3
**Last verified:** 2026-09-30

---

## 1. Scope

This SOP covers:

1. Local development operation ($0)
2. Production deployment options that cost $0
3. The free data-source APIs the app depends on, their limits, and how to stay
   inside those limits
4. Day-2 operations: monitoring, cache management, troubleshooting
5. A cost inventory proving the running total is $0/month

Out of scope: paid hosting, paid API tiers, custom domain purchase
(optional upgrade — not required).

---

## 2. System Overview

```
Browser ──> Next.js app (pages + /api routes)
              │
              ├─> SQLite cache  data/app.db  (real_people, real_properties, real_phones)
              │
              └─> Live free APIs (queried only on cache miss):
                    ├── miamidade  — Miami-Dade Property Appraiser (ArcGIS)  — no key
                    ├── philly     — Philadelphia OPA (CARTO SQL)            — no key
                    ├── acris      — NYC ACRIS (Socrata Open Data)           — no key
                    ├── fec        — api.open.fec.gov                        — DEMO_KEY / free key
                    ├── cnamlookup — freecnamlookingup.com                   — no key
                    ├── freecnam   — freecnam.org                            — no key
                    └── numbersonline — numbers.online                       — free key (optional)
```

**Design principle:** every external record is fetched once and persisted in
SQLite. Repeat lookups are served locally forever and consume zero API quota.

There is **no synthetic/mock/demo data** anywhere in the codebase. If no real
record exists, the app returns empty results.

---

## 3. Cost Inventory — Running Total: $0.00 / month

| # | Component | Provider | Plan | Cost | Limit to respect |
|---|-----------|----------|------|------|------------------|
| 1 | Source code hosting | GitHub | Free (public repo) | $0 | Unlimited public repos |
| 2 | Runtime (dev) | Your own PC | — | $0 | Electricity only |
| 3 | App hosting (prod) | Vercel | Hobby | $0 | 100 GB bandwidth/mo; serverless execution limits; non-commercial use |
| 4 | App hosting (alt.) | Netlify / Render / Oracle Always Free | Free tiers | $0 | See §7 |
| 5 | Database | SQLite file on disk | — | $0 | Disk space only |
| 6 | Property records (FL) | gisweb.miamidade.gov | Public ArcGIS | $0 | No key; fair use |
| 7 | Property records (PA) | phl.carto.com | Public CARTO | $0 | No key; fair use |
| 8 | Property records (NY) | data.cityofnewyork.us | Socrata Open Data | $0 | No key (app token optional, still free) |
| 9 | Donor records | api.open.fec.gov | DEMO_KEY or free key | $0 | ~40 calls/hr on DEMO_KEY; 1,000/hr with free `FEC_API_KEY` |
| 10 | Phone CNAM lookup | freecnamlookingup.com | Free public API | $0 | App self-throttles to 1 call / 1.2 s; 429s trigger cooldown |
| 11 | Phone CNAM fallback | freecnam.org | Free dip | $0 | Best-effort, 8 s timeout |
| 12 | Phone spam score | numbers.online | Free API key | $0 | Optional — skipped entirely if `NUMBERS_ONLINE_KEY` is unset |
| 13 | Domain name | `<name>.vercel.app` (or host subdomain) | Included | $0 | Custom domain is an optional purchase, not required |
| 14 | TLS certificate | Let's Encrypt via host | Auto | $0 | Automatic on all listed hosts |
| 15 | CI/builds | GitHub Actions | Free for public repos | $0 | Optional — not currently configured |
|    | **TOTAL** | | | **$0/month** | |

---

## 4. Prerequisites (all free)

| Tool | Version | Get it | Cost |
|------|---------|--------|------|
| Node.js LTS | ≥ 20.x | nodejs.org | $0 |
| npm | bundled with Node | — | $0 |
| Git | any recent | git-scm.com | $0 |
| GitHub account | free tier | github.com | $0 |
| Vercel account (deploy only) | Hobby | vercel.com — sign in with GitHub | $0 |
| FEC API key (optional) | free, 1,000 req/hr | api.data.gov/signup | $0 |
| numbers.online key (optional) | free tier | numbers.online | $0 |

---

## 5. Procedure A — Run Locally ($0)

### 5.1 Clone and install

```bash
git clone https://github.com/sarfraj-dev11/people-search.git
cd people-search
npm install
```

### 5.2 Configure environment (optional)

The app runs fully without any env file. Optional upgrades:

```bash
# .env.local   (gitignored — never commit)
FEC_API_KEY=<your free api.data.gov key>        # raises FEC quota 40→1000 req/hr
NUMBERS_ONLINE_KEY=<your free numbers.online key>  # enables spam-score enrichment
```

Without keys: FEC falls back to `DEMO_KEY`, and the spam-score enrichment step
is skipped. All other sources work unchanged.

### 5.3 Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`. First-run behavior: `data/app.db` is created
automatically (WAL mode) on the first lookup; the `data/` directory is
gitignored.

### 5.4 Verification checklist

| Check | How | Expected |
|-------|-----|----------|
| Home/search page loads | open `/` | Search UI renders |
| Person search | search a common surname + `Miami, FL` | Real owner records labeled "Miami-Dade Property Appraiser" |
| Donor search | search a surname + `TX` | FEC "Political Donor" results |
| Phone lookup | open `/phone`, enter a 10-digit US number | Carrier + CNAM name or "not found" |
| Cache works | repeat the same search | Instant result, no new network calls |
| Lint clean | `npm run lint` | No errors |

### 5.5 Production build locally

```bash
npm run build && npm start   # serves on :3000
```

---

## 6. Procedure B — Deploy to Vercel Hobby ($0)

Vercel Hobby is $0 for non-commercial use and is the lowest-effort host for
Next.js.

### 6.1 Steps

1. Push the repo to GitHub (done — see repo URL above).
2. Go to `vercel.com/new` → **Import Git Repository** → select `people-search`.
3. Framework preset auto-detects Next.js. Keep defaults:
   - Build: `next build` · Output: `.next` · Install: `npm install`
4. **Environment Variables** (optional, all $0):
   - `FEC_API_KEY` — free key from api.data.gov
   - `NUMBERS_ONLINE_KEY` — free key from numbers.online
5. Click **Deploy**. The app goes live at `https://<project>.vercel.app`
   with automatic TLS.

### 6.2 Serverless caveats (important)

- **SQLite is ephemeral on Vercel.** `getDb()` detects the read-only project
  filesystem and falls back to `os.tmpdir()`, and if that fails returns `null`
  and serves results directly without caching. The app still works; the cache
  just does not survive across function invocations. This means more live API
  calls — stay mindful of §8 limits.
- **`better-sqlite3`** is a native module. It is already declared in
  `serverExternalPackages` in `next.config.ts` — do not remove that line.
- **No commercial use** on Hobby. If the app becomes commercial, a paid plan is
  required and this SOP no longer applies.

### 6.3 Procedure B-alt — Persistent SQLite at $0

If durable caching matters, use a host with a persistent filesystem:

| Host | Free tier | SQLite persistence | Caveat |
|------|-----------|--------------------|--------|
| Oracle Cloud Always Free VM | $0 forever (4 ARM cores, 24 GB RAM) | Yes — real disk | You run `npm start` behind a free reverse proxy (Caddy/Cloudflare Tunnel); capacity for new accounts can be limited |
| Render free web service | $0 | Ephemeral disk (free tier) | Sleeps after 15 min idle — cold starts |
| Fly.io | Hobby allowance | Via attached volume | Volume billing can apply above free allowance — monitor |
| Own PC + Cloudflare Tunnel | $0 | Yes | PC must stay on; residential IP TOS |

The zero-effort recommendation remains Vercel; the zero-cost + persistence
recommendation is Oracle Always Free or a spare PC + `cloudflared`.

---

## 7. Data-Source Operating Rules (stay free)

| Source | Jurisdiction | Skips when | Quota behavior |
|--------|--------------|------------|----------------|
| miamidade | Miami-Dade, FL | `where` is outside Miami/FL | No key; app caps at 25 rows/query |
| philly | Philadelphia, PA | `where` is outside Philly/PA | No key; LIMIT 25 |
| acris | NYC 5 boroughs | never skipped by jurisdiction | No key; Socrata throttles anonymous traffic — caching absorbs this |
| fec | Nationwide | never | DEMO_KEY ≈ 40 req/hr shared — set `FEC_API_KEY` (free) for 1,000/hr |
| cnamlookup | US numbers | per-request | Self-paced 1.2 s gap; 429 → 60 s cooldown; 3 retries with backoff |
| freecnam | US numbers | only when CNAM is missing/generic | 8 s timeout, best-effort |
| numbersonline | US numbers | no `NUMBERS_ONLINE_KEY` set | Free key; 429/5xx → 5 min cooldown |

**Cooldown mechanism:** any source that errors is marked down for 5 minutes
(`sourceDown` map in `src/lib/real.ts`), so a dead API cannot stall requests.
Cooldowns are in-memory per server instance — they reset on restart, which is
safe.

**Rule of thumb:** because results are cached, cost/quota consumption is
proportional to *unique* queries, not total queries. Warm the cache, and API
usage trends toward zero.

---

## 8. Routine Operations

### 8.1 Search flows

- **Person by name:** `/` → name + optional `City, ST` / state / ZIP.
  `parseWhere()` normalizes the location. On cache miss all in-jurisdiction
  sources are queried in parallel, results ingested, then re-queried locally.
- **Person detail:** `/name/<slug>-r<id>` — served entirely from SQLite.
- **Reverse phone:** `/phone` or `GET /api/phone?number=+1XXXXXXXXXX`.
  Returns validity, line type, carrier, underlying network (for MVNOs),
  registered CNAM name, city/state, spam score, risk level, confidence.
- **Reverse address:** in-jurisdiction ArcGIS/CARTO property records.

### 8.2 Cache / DB management

```bash
# Inspect the cache
sqlite3 data/app.db "SELECT source, COUNT(*) FROM real_people GROUP BY source;"

# Reset entirely (safe — schema auto-recreates on next request)
rm -f data/app.db data/app.db-shm data/app.db-wal
```

- DB lives at `data/app.db` (project dir) — gitignored, never committed.
- WAL sidecar files (`-shm`, `-wal`) are normal; do not delete while the app runs.
- There is no TTL — records persist indefinitely. Manual purge if you ever need
  freshness: `DELETE FROM real_people WHERE fetched_at < 'YYYY-MM-DD';`

### 8.3 Updating the app

```bash
git pull origin main
npm install        # only if package.json changed
npm run lint && npm run build
npm run dev        # or restart the production process / redeploy
```

On Vercel, pushing to `main` redeploys automatically.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty results for a name | No real records exist in covered jurisdictions, or sources down | Try a name known to own property in Miami/Philly/NYC, or a donor surname; check server log for fetch errors |
| FEC always empty | DEMO_KEY hourly quota exhausted | Set `FEC_API_KEY` (free, api.data.gov) |
| Phone lookup slow on first call | CNAM pacing (1.2 s) + retry backoff on 429 | Expected; subsequent identical lookups are instant (cached) |
| "Wireless Caller" as name | Carrier did not register a real CNAM name | Expected — real carrier data can be generic; the freecnam.org fallback already tried |
| No spam score | `NUMBERS_ONLINE_KEY` unset or API cooldown | Set the free key, or wait out the 5-min cooldown |
| Vercel deploy: sqlite errors | Native module bundled incorrectly | Ensure `serverExternalPackages: ["better-sqlite3"]` remains in `next.config.ts` |
| Port 3000 in use | Another dev server | `npm run dev -- -p 3001` |

---

## 10. Keeping It at $0 — Guardrails

1. **Do not add paid APIs.** The architecture assumption is free public data.
   Any new source must have a keyless or free-key tier.
2. **Keep caching.** Every uncached deployment mode burns free quota faster.
   Prefer a host with a writable filesystem if traffic grows.
3. **Watch Vercel usage** (dashboard → Usage). At ~100 GB bandwidth/mo or high
   function-invocation volume, Hobby limits approach — cache warms mitigate
   this, but migrate to a $0 VM before upgrading to paid.
4. **Watch FEC quota** (`X-RateLimit-*` headers). DEMO_KEY shared quota is the
   tightest limit in the system; the free personal key removes it.
5. **No custom domain required.** Use the free `*.vercel.app` subdomain.
6. **Keep the repo public** if relying on free GitHub/private-repo-adjacent
   tooling; the repo itself is free either way.

---

## 11. Data & Compliance Notes

- All records are **public government data** (property appraisals, recorded
  documents, FEC filings) or carrier-published CNAM data. Still, surface the
  source label on every result (the app does via `SOURCE_LABELS`) and honor
  any upstream Terms of Service.
- `NUMBERS_ONLINE_KEY` and `FEC_API_KEY` are secrets — they live in
  `.env.local` / Vercel env vars, never in the repo.
- SQLite DB is local-only (gitignored) and contains only records already public
  at the source APIs.

---

## 12. Quick Reference

```bash
npm run dev     # develop          → localhost:3000
npm run lint    # lint
npm run build   # production build
npm start       # serve built app  → localhost:3000
```

| Path | Purpose |
|------|---------|
| `/` | People search |
| `/phone` | Reverse phone UI |
| `/api/phone?number=` | Phone lookup JSON API |
| `data/app.db` | SQLite cache (auto-created, gitignored) |
| `src/lib/real.ts` | All free data-source adapters + cooldowns |
| `src/lib/db.ts` | SQLite init, schema, serverless fallback |
| `src/lib/repo.ts` | Search/lookup orchestration + result shaping |
| `src/lib/names.ts` | `parseWhere()` — always use for location parsing |
