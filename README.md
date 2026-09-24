# Maida Vale — Brief QA & Continuity Desk

## Project Overview
- **Name**: Maida Vale QA & Continuity Desk
- **Goal**: Companion QA tool for the weekly Maida Vale Weekly Brief (Al Bukhary Group). Lets the consultant review each week's brief (Thursday Draft 1 → Friday Draft 2) before it goes to the director, catching house-rule violations and repeated news before submission.
- **4 Modules**:
  1. **Weekly Briefs Archive** — upload (.docx/.pdf), view, edit, delete briefs; grouped by week with Draft 1 (Thu) / Draft 2 (Fri) / Final stage badges; click into any week to see its rows.
  2. **Compliance Check** — runs the full house rule engine against every row.
     - Banned/weak vocabulary (could, may, supports, across the Group, etc.)
     - Impact-cell opener must be exactly one plain single word: **Positive / Negative / Neutral / Mixed** — no qualifiers attached to the label (per Syazwan's 4 Sep 2026 ruling; see "Known house-style conflicts" below — this superseded the 7 Sep 2026 PPTX checklist v2's 8-tier system, which is no longer enforced)
     - **Transmission mechanism check** — Impact must show the causal chain from the news to the business (e.g. "Oil ↑ → fuel procurement ↑ → Malakoff margins pressured"), not just a restated fact
     - **Named-entity linkage** — Impact must name a real Al Bukhary business from the ownership map; a bare "Group" reference is rejected even if grammatically avoided
     - "Figure … from X" comparison-base requirement, consistent basis/timeframe
     - Certainty-preservation check (mulls ≠ will, plans ≠ committed, approved ≠ secured)
     - **Headline/Summary alignment** — flags when the headline reads as a proposal but the summary reads as decided (or vice versa)
     - **Abbreviation first-use expansion** — BESS, DCTF, NIF, NRW, WTP, PUE, TBIP, SAC must be spelled out on first mention anywhere in the brief
     - Associate/JV ownership-% reminders (never call an associate a subsidiary), missing source attribution
     - **v3** — mined from 10 real director/manager change-log editions (24 Jul – 11 Sep 2026), per instruction "make sure review and don't repeat same mistakes every week":
       - **"Relevant to X" banned connector** — the single most-repeated fault across editions (flagged 31 Jul, 7 Aug, 21 Aug, 4 Sep despite repeated correction); also bans "with implications for", "despite external uncertainties", "highlighting supply chain risks", "reinforcing", "validate/validates"
       - **Entity named then denied** — Impact names a real Al Bukhary business and then says "no direct Group channel"/"no Group exposure" in the same cell (7 Aug #1)
       - **Regulatory cell restates Summary/Impact** or carries a bare monitoring disclaimer instead of an actual policy mechanism (24 Jul #20, 31 Jul C9, 4 Sep #35/#48)
       - **Regulatory cell is a bare dash** — house style per the 6 Aug director review is the standard sentence *"No new regulatory or policy changes were introduced."* instead of "-" (info-level nudge; see house-style conflict note below)
       - **Unnamed attribution** — "analysts expect", "industry leaders urged", "sources said" with no named research house/forum (6 Aug B8, 7 Aug #26, 11 Sep #24)
       - **Source attribution leaking into Impact** — "according to sources"/"Reuters noted" belongs in the Summary, not the Group's own read in Impact (7 Aug #16, 4 Sep #66)
       - **Grade-perspective check** — a Positive/Strategic-tier grade paired with competitor-gaining-ground language ("intensifying competition", "outperform the broader market") is flagged for a from-whose-chair review (24 Jul #11/#12)
       - **Expanded abbreviation list** — TIV, xEV, TNB, MITI, AMRO, GM32, PETRA, AIRB, MNRB, CAAM, PDRM, AVSEC, MEP, FMM, GDV, NAFAS, MIDA, MPOB, BNM, SOFR, TEU, LNG, E&E, AI, plus mom/yoy/wow/qoq tracked brief-wide
     - **v4** — resolved house-style conflicts (director decision, 24 Sep 2026): reverted Impact grade to the plain 4-grade system (see above), and added a **currency-code spacing check** — flags any "RM 170.5" / "USD 104.35" (space between the currency code and the figure) as house style is now no-space ("RM170.5", "USD104.35"), per the 11 Sep 2026 ruling; the space before the unit (bn/mn/tn) is retained and not flagged
  3. **Redundancy vs Prior Briefs** — Jaccard-similarity text comparison against up to 4 prior briefs, classified as likely duplicate / continuing story / similar topic. **v3 addition**: also checks for **repetition within the SAME edition** (Sec 2 restating Sec 1/3, Speed Read restating the Executive Summary, two rows ending on the same channel sentence) — a distinct fault from cross-week redundancy, flagged in the 31 Jul, 7 Aug and 21 Aug editions; shown as a separate "Repeats within this same edition" section on the Redundancy tab.
  4. **Daily News Log** — **auto-populated**: once per calendar day, the app automatically checks Bernama/Malay Mail/The Guardian's public RSS feeds against your Al Bukhary entity list + a curated sector-keyword watchlist and logs any matching headline for you (tagged "Auto", with the matched term shown). Runs itself the first time the tab is opened that day — no button needed — plus a "Run Sweep Now" button for an on-demand refresh. Manual entries (tagged "Manual") stay available for anything you read on the paywalled/bot-blocked outlets. Entries can be linked to the brief they end up in.
  - Plus an **Al Bukhary Entity Map** admin view (subsidiaries vs associates, ownership %, aliases) used by the compliance engine.

## URLs
- **Local dev preview**: https://3000-i77uenqd0jq85mc5rvhj8-2e77fc33.sandbox.novita.ai (sandbox dev server — not yet deployed to production)
- **Live Brief Site (companion, separate app)**: https://maida-vale-weekly-brief.pages.dev
- **Production**: not yet deployed — pending Cloudflare API token + decision on deploy target (own project vs. same project as the live brief site)

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) for all structured data; Cloudflare R2 for original uploaded .docx/.pdf files.
- **Tables**: `briefs`, `brief_rows`, `daily_log` (+ `origin`/`matched_term` columns), `entities`, `compliance_issues`, `redundancy_matches` (+ v3 `scope` column: `cross_week` vs `intra_brief`), `app_settings` (see `migrations/0001_initial_schema.sql`, `0002_auto_sweep.sql`, `0003_v3_rules.sql`).
- **Auto-sweep**: `src/lib/sweep.ts` + `src/lib/watchlist.ts`. Cloudflare Pages hosted deploy has no background cron (`triggers` is unsupported), so this uses a "lazy cron": the sweep runs at most once per Asia/Kuala_Lumpur calendar day, triggered by the first `GET /api/daily-log` request of the day; `POST /api/daily-log/sweep` forces an immediate re-run. Feeds actually fetched: **Bernama** (`bernama.com/en/rssfeed.php`), **Malay Mail** (`malaymail.com/feed/rss/malaysia`), **The Guardian** (`theguardian.com/world/malaysia/rss`) — Reuters/The Star/The Edge/NST/The Sun either sit behind a bot-challenge (Cloudflare 403) or return 404 on every public-feed URL path tested and cannot be fetched headlessly from the edge; those remain manual-entry + Source Cross-Check search links. **Fixed 24 Sep 2026**: the two feed URLs originally wired up for Bernama (`/en/rss/general.xml`) and NST (`/rss/latest`) were both dead (404 and 403 respectively) since this app was first built, so "Run Sweep Now" was silently only ever pulling from The Guardian's narrow Malaysia-only feed — this is why the log only ever showed ~1 headline. Swapped in Bernama's actual working feed and replaced the dead NST feed with Malay Mail (also one of the consultant's 6 primary sources), which restores 2 of the 3 outlets and roughly triples the items scanned per sweep (~60 vs ~20).
- **Entity seed data**: `seed.sql` — full Al Bukhary Group ownership map (65 entities), sourced from the authoritative "Albukhary Group Companies" ownership deck (Sept 2026), covering all 3 controlled groups (MMC Corporation 100%, Tradewinds Group (M) 100%, DRB-HICOM 55.92%) plus strategic holdings (Media Prima 31.9%, EcoWorld 30.1%, EWI Capital 33.28%, MPH Group), with exact holding chains, subsidiary/associate/JV relationship types and ownership percentages (e.g. Malakoff 38.45% associate, Alam Flora 97.37% under Malakoff not DRB-HICOM, Bank Muamalat and Pos Malaysia under DRB-HICOM, Proton 50.10% with Geely as JV partner).
- **Parsing**: Word files are parsed client-side with `mammoth.js` (table-aware, column-accurate); PDFs are parsed client-side with `pdf.js` using a heuristic line-reconstruction (best-effort — flagged in the UI for manual review).

## User Guide
1. Go to **Weekly Briefs (Archive)** → **Upload** → fill in week label, draft stage (Draft 1 Thu / Draft 2 Fri / Final), period dates, title, and drag in the .docx or .pdf. The file is parsed in-browser and rows are pre-filled.
2. Click into the week to view/edit/delete individual rows, or edit/delete the whole brief.
3. Click **Run Check** to execute the Compliance and Redundancy checks; review flagged issues under the **Compliance** and **Redundancy** tabs before sending to the director.
4. Use **Source Cross-Check** tab on a brief to get one-click search links across all 8 outlets (Reuters, The Star, The Edge, Bernama, Malay Mail, NST, The Sun, The Guardian), plus live headlines for the outlets with a working public feed (Bernama, Malay Mail, The Guardian).
5. Use **Daily News Log** through the week to capture developments as they happen, so Friday's Draft 2 update is quick to assemble.
6. Maintain the **Entity Map** as Al Bukhary's group structure changes.

## Known house-style conflicts requiring a director decision
Mining all 10 historical change logs surfaced a small number of points where **different editions carry contradictory rulings**. Two of the four have now been resolved by explicit director decision (24 Sep 2026); the remaining two are still open.

1. ✅ **RESOLVED (24 Sep 2026) — Impact grade format: single word vs multi-word tier.** The **4 Sep 2026** change log states explicitly (item 24): *"Every Impact cell opens with one word from Positive, Negative, Mixed, Neutral, then a full stop... No qualifiers attached to the label... Syazwan has ruled."* This directly contradicted the **8-label tiered system** (adding Strategic Benchmark / Opportunity Watch / Policy Watch / High Strategic Relevance) from the **7 Sep 2026 PPTX checklist v2** that the app previously enforced as `IMPACT_OPENERS` in `compliance.ts`. **Decision**: the 4 Sep plain-single-word ruling stands and overrides the 7 Sep PPTX on this point. `IMPACT_OPENERS`, `checkImpactOpener()`, `checkGradePerspective()`, `types.ts`, `app.js` and `parser.js` have all been reverted to the 4-grade system (Positive/Negative/Neutral/Mixed only, no qualifiers).
2. ✅ **RESOLVED (24 Sep 2026) — Currency-code spacing.** The **11 Sep 2026** log (item 1) rules "RM170.5 bn" with **no space** between the currency code and the figure, closing the space at every occurrence. Earlier editions (e.g. 24 Jul #37, 27-31 Jul B1) consistently used "RM 1.5 bn" **with a space**. **Decision**: the 11 Sep no-space ruling stands and reverses all earlier editions' style. Implemented as the new `checkCurrencySpacing()` rule (`currency_spacing`) in `compliance.ts`, checked across headline/summary/impact/regulatory text — flags any currency code followed by a space then a figure; the space before the unit (bn/mn/tn) is retained and not flagged.
3. **Regulatory cell when nothing changed — dash vs boilerplate sentence.** The **6 Aug 2026** review (item 3) rules that a blank Regulatory cell must read *"No new regulatory or policy changes were introduced."* instead of a bare "-". This app implements that as an **info-level** nudge only (`regulatory_boilerplate` rule), not an error, because no later edition explicitly re-confirms or reverses it, and a bare "-" continued to appear in later logs (e.g. 21 Aug) without being flagged again — it's unclear whether the 6 Aug ruling was adopted going forward or was a one-off note for that edition. **Still open.**
4. **Compound grade labels ("Mixed/Industry Read-Through", "Neutral/Competitive Benchmark").** The **7 Aug 2026** log documents these as a **third, interim** grading style sitting between the old 4-grade system and the 8-label system, explicitly flagged as "the compound-label ruling still outstanding" pending a decision. Since the 8-label system has itself now been superseded by the 4 Sep single-word ruling (see #1), this compound-label style is moot and is **not** implemented — noted here only so it is not mistaken for a still-open format if it resurfaces. **Still open (moot).**

Items 3 and 4 remain deliberate omissions pending further director confirmation, per the "don't repeat the same mistakes" instruction not extending to "guess when the house itself disagreed with itself."

## Deployment
- **Platform**: Cloudflare Pages (Hono + D1 + R2)
- **Status**: ❌ Not yet deployed to production — currently local-dev only (PM2 + `wrangler pages dev --local`)
- **Tech Stack**: Hono + TypeScript + Vite, D1 (SQLite), R2, vanilla-JS SPA frontend (Tailwind CDN), mammoth.js + pdf.js for client-side document parsing
- **Outstanding before production deploy**:
  - Create real D1 database (`wrangler d1 create maida-vale-qa-production`) and R2 bucket, replace the placeholder `database_id` in `wrangler.jsonc`
  - Requires a Cloudflare API token (not yet supplied) — use the `cf-byok-deploy` or `gsk-hosted-deploy` skill when ready
  - Confirm with user: deploy as its own Pages project, or alongside the existing `maida-vale-weekly-brief` site
- **Last Updated**: 2026-09-24 (v4: resolved 2 house-style conflicts per director decision — reverted to 4-grade Impact system, added currency-code no-space rule; fixed the auto-sweep's dead Bernama/NST RSS URLs — swapped in Bernama's working feed + Malay Mail in place of NST)
