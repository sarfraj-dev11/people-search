<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- `npm run dev` → http://localhost:3000 · `npm run lint` · `npm run build`
- SQLite DB at `data/app.db` (gitignored). **Real public records only** — tables `real_people` / `real_properties` hold records ingested from free government APIs in `src/lib/real.ts`. There is NO synthetic/mock/demo data anywhere: no seeding, no fabricated records, no demo mode.
- Real sources: `miamidade` (ArcGIS, FL), `philly` (CARTO, PA), `acris` (NYC Socrata), `fec` (api.open.fec.gov). Each skips when the searched location is outside its jurisdiction. A source that errors is marked down for 5 min (`sourceDown`) so unreachable APIs don't stall requests.
- Phone lookup uses `freecnamlookingup.com/api/lookup` (free CNAM — real registered caller names + carrier + city/state) enriched by `numbers.online` (spam score; key in `NUMBERS_ONLINE_KEY` env/.env.local). Results cache in `real_phones`. CNAM names are real registered carrier names — they can be stale or generic ("Wireless Caller"), that's expected.
- FEC uses `DEMO_KEY` (~40 calls/hr). Set `FEC_API_KEY` env var for a real key (1000/hr, free at api.data.gov/signup).
- `parseWhere()` in `src/lib/names.ts` parses "City, ST" / state names / ZIP — always use it for `where` handling; it maps full state names ("Texas") to codes ("TX").
- Multiple edits to the same file in one parallel tool call can race and silently revert each other — edit one change at a time per file.
