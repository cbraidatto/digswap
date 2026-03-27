# Phase 8: Gamification + Rankings — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Session:** 2026-03-27
**Participants:** User + Claude

---

## Area 1: Ranking Formula Weights

**Q: How much does collection rarity vs. community contribution count?**
Options: Coleção-first (70/30) / Balanceado (50/50) / Comunidade-first (40/60)
**Selected:** Coleção-first (70/30)
Rationale: DigSwap nasce do Discogs, o coração do produto é a coleção.

**Q: How is the user's rarity score aggregated from individual records?**
Options: SUM / AVG / Top-50 AVG / SUM(log(1 + rarityScore))
**Process:** User requested external research before deciding.
Research found: VinylRank.com uses logarithmic rarity for Discogs community. SUM inflates with bulk common records (Last.fm leaderboard problem). AVG ignores collection depth.
**Selected:** SUM(log(1 + rarityScore)) — logarithmic sum across full collection

**Q: Contribution score point values?**
Proposed: reviews×10, posts×3, trades×15, follows×1, followers×2
**Selected:** Approved as proposed.

---

## Area 2: Leaderboard Presentation

**Q: Where does the leaderboard live?**
Options: `/rankings` page / sidebar widget on `/feed` / section in `/explorar`
**Selected:** Section in `/explorar` — `RANKINGS` tab

**Q: What appears per leaderboard row?**
Options: Rank + username + title + score / with avatar + badges
**Selected:** `#[rank] · username · title · score pts` — no avatar on rows

**Q: Which leaderboard scopes?**
Options: Global only / Global + genre / Global + genre + time periods
**Selected:** Global + per genre (matching Phase 7 auto-generated genre groups)

**Q: How to navigate between genre leaderboards?**
Options: Dropdown / Filter chips
**Selected:** Claude's Discretion — user wants something visually distinctive

---

## Area 3: Badges

**Q: Which badges ship in v1?**
Proposed: FIRST_DIG, CENTURY_CLUB, RARE_FIND, CRITIC, CONNECTOR, CREW_MEMBER
**Selected:** Approved all 6 as proposed.

---

## Area 4: Rank Tier Titles

**Q: Should titles be based on global score or collection count?**
**Selected:** Global score (full formula)

**Q: Keep existing title names from profile stub?**
Existing: Vinyl Rookie / Crate Digger / Wax Prophet / Record Archaeologist
**Selected:** Keep as-is.

Thresholds defined: 0–50 / 51–200 / 201–500 / 501+

---

## Area 5: Rank Update Cadence

**Q: Real-time (Redis) or scheduled (pg_cron)?**
Options: pg_cron 15min / Redis sorted sets now
**Selected:** pg_cron every 15 minutes — Redis deferred until user volume justifies it.
