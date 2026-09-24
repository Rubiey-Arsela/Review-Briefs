# Maida Vale — Brief QA & Continuity Desk

## Project Overview
- **Name**: Maida Vale QA & Continuity Desk
- **Goal**: Companion QA tool for the weekly Maida Vale Weekly Brief (Al Bukhary Group). Lets the consultant review each week's brief (Thursday Draft 1 → Friday Draft 2) before it goes to the director, catching house-rule violations and repeated news before submission.
- **4 Modules**:
  1. **Weekly Briefs Archive** — upload (.docx/.pdf), view, edit, delete briefs; grouped by week with Draft 1 (Thu) / Draft 2 (Fri) / Final stage badges; click into any week to see its rows.
  2. **Compliance Check** — runs the full house rule engine (v2, per the manager's "Updated Master Checklist") against every row:
     - Banned/weak vocabulary (could, may, supports, across the Group, etc.)
     - Impact-cell opener must be exactly one of: **Positive / Negative / Neutral / Mixed / Strategic Benchmark / Opportunity Watch / Policy Watch / High Strategic Relevance** — no longer forced into simple Positive/Negative
     - **Transmission mechanism check** — Impact must show the causal chain from the news to the business (e.g. "Oil ↑ → fuel procurement ↑ → Malakoff margins pressured"), not just a restated fact
     - **Named-entity linkage** — Impact must name a real Al Bukhary business from the ownership map; a bare "Group" reference is rejected even if grammatically avoided
     - "Figure … from X" comparison-base requirement, consistent basis/timeframe
     - Certainty-preservation check (mulls ≠ will, plans ≠ committed, approved ≠ secured)
     - **Headline/Summary alignment** — flags when the headline reads as a proposal but the summary reads as decided (or vice versa)
     - **Abbreviation first-use expansion** — BESS, DCTF, NIF, NRW, WTP, PUE, TBIP, SAC must be spelled out on first mention anywhere in the brief
     - Associate/JV ownership-% reminders (never call an associate a subsidiary), missing source attribution
  3. **Redundancy vs Prior Briefs** — Jaccard-similarity text comparison against up to 4 prior briefs, classified as likely duplicate / continuing story / similar topic.
  4. **Daily News Log** — **auto-populated**: once per calendar day, the app automatically checks Bernama/NST/The Guardian's public RSS feeds against your Al Bukhary entity list + a curated sector-keyword watchlist and logs any matching headline for you (tagged "Auto", with the matched term shown). Runs itself the first time the tab is opened that day — no button needed — plus a "Run Sweep Now" button for an on-demand refresh. Manual entries (tagged "Manual") stay available for anything you read on the paywalled outlets. Entries can be linked to the brief they end up in.
  - Plus an **Al Bukhary Entity Map** admin view (subsidiaries vs associates, ownership %, aliases) used by the compliance engine.

## URLs
- **Local dev preview**: https://3000-i77uenqd0jq85mc5rvhj8-2e77fc33.sandbox.novita.ai (sandbox dev server — not yet deployed to production)
- **Live Brief Site (companion, separate app)**: https://maida-vale-weekly-brief.pages.dev
- **Production**: not yet deployed — pending Cloudflare API token + decision on deploy target (own project vs. same project as the live brief site)

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) for all structured data; Cloudflare R2 for original uploaded .docx/.pdf files.
- **Tables**: `briefs`, `brief_rows`, `daily_log` (+ `origin`/`matched_term` columns), `entities`, `compliance_issues`, `redundancy_matches`, `app_settings` (see `migrations/0001_initial_schema.sql`, `0002_auto_sweep.sql`).
- **Auto-sweep**: `src/lib/sweep.ts` + `src/lib/watchlist.ts`. Cloudflare Pages hosted deploy has no background cron (`triggers` is unsupported), so this uses a "lazy cron": the sweep runs at most once per Asia/Kuala_Lumpur calendar day, triggered by the first `GET /api/daily-log` request of the day; `POST /api/daily-log/sweep` forces an immediate re-run. Only Bernama/NST/The Guardian have free public RSS — Reuters/The Star/The Edge/Malay Mail/The Sun remain manual-entry + Source Cross-Check search links.
- **Entity seed data**: `seed.sql` — full Al Bukhary Group ownership map (65 entities), sourced from the authoritative "Albukhary Group Companies" ownership deck (Sept 2026), covering all 3 controlled groups (MMC Corporation 100%, Tradewinds Group (M) 100%, DRB-HICOM 55.92%) plus strategic holdings (Media Prima 31.9%, EcoWorld 30.1%, EWI Capital 33.28%, MPH Group), with exact holding chains, subsidiary/associate/JV relationship types and ownership percentages (e.g. Malakoff 38.45% associate, Alam Flora 97.37% under Malakoff not DRB-HICOM, Bank Muamalat and Pos Malaysia under DRB-HICOM, Proton 50.10% with Geely as JV partner).
- **Parsing**: Word files are parsed client-side with `mammoth.js` (table-aware, column-accurate); PDFs are parsed client-side with `pdf.js` using a heuristic line-reconstruction (best-effort — flagged in the UI for manual review).

## User Guide
1. Go to **Weekly Briefs (Archive)** → **Upload** → fill in week label, draft stage (Draft 1 Thu / Draft 2 Fri / Final), period dates, title, and drag in the .docx or .pdf. The file is parsed in-browser and rows are pre-filled.
2. Click into the week to view/edit/delete individual rows, or edit/delete the whole brief.
3. Click **Run Check** to execute the Compliance and Redundancy checks; review flagged issues under the **Compliance** and **Redundancy** tabs before sending to the director.
4. Use **Source Cross-Check** tab on a brief to get one-click search links across all 8 outlets (Reuters, The Star, The Edge, Bernama, Malay Mail, NST, The Sun, The Guardian), plus live headlines for the outlets with public feeds (Bernama, NST, The Guardian).
5. Use **Daily News Log** through the week to capture developments as they happen, so Friday's Draft 2 update is quick to assemble.
6. Maintain the **Entity Map** as Al Bukhary's group structure changes.

## Deployment
- **Platform**: Cloudflare Pages (Hono + D1 + R2)
- **Status**: ❌ Not yet deployed to production — currently local-dev only (PM2 + `wrangler pages dev --local`)
- **Tech Stack**: Hono + TypeScript + Vite, D1 (SQLite), R2, vanilla-JS SPA frontend (Tailwind CDN), mammoth.js + pdf.js for client-side document parsing
- **Outstanding before production deploy**:
  - Create real D1 database (`wrangler d1 create maida-vale-qa-production`) and R2 bucket, replace the placeholder `database_id` in `wrangler.jsonc`
  - Requires a Cloudflare API token (not yet supplied) — use the `cf-byok-deploy` or `gsk-hosted-deploy` skill when ready
  - Confirm with user: deploy as its own Pages project, or alongside the existing `maida-vale-weekly-brief` site
- **Last Updated**: 2026-09-24
