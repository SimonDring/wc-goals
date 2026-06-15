# World Cup 2026 Goals Sweepstake — Design Spec

**Date:** 2026-06-15
**Owner:** Simon
**Status:** Approved design (pending spec review)

## 1. Purpose

A mobile-first, auto-updating **hosted website** that tracks goals scored by every team in
the 2026 FIFA World Cup, and ranks 31 family members by the combined goals of their two
assigned teams. Shared as a single link in a family group chat for a sweepstake where the
person whose teams score the most goals wins a prize.

Success = a public URL that:
- shows correct, current goal tallies with no manual upkeep,
- is easy to read and search on a phone,
- clearly answers "who is winning the prize."

## 2. Data source (verified)

- **football-data.org** free tier, competition `WC` (FIFA World Cup), endpoint
  `GET /v4/competitions/WC/matches`. Returns every match with scores across the whole
  tournament (group + knockouts). Free auth token (10 calls/min — far more than needed).
- **Rejected sources & why:**
  - Wikipedia — excluded by user.
  - FBref / worldfootball.net — return HTTP 403 to automated fetchers (would block any
    scraper/Sheet fetcher too).
  - footystats.org — JavaScript SPA, shows *qualifying* numbers, not the tournament.
  - TheSportsDB free test key — **truncates results to 5 matches**; unusable for a full tally.
- football-data.org does **not** allow browser (CORS) requests, so it is called
  **server-side** by the scheduled job (token kept in GitHub Secrets, never shipped to the
  browser).

## 3. Architecture

Three small, independently-understandable parts:

```
[ GitHub Action cron (every ~30 min) ]
        |  fetches WC matches (token in Secrets)
        v
[ build script ]  --> computes & writes  public/data.json
        |
        v
[ static site (public/) ]  reads data.json, renders UI
        |
        v
[ GitHub Pages ]  --> https://<user>.github.io/wc-goals  (the shareable link)
```

### 3.1 Build script (`scripts/build-data.(mjs|py)`)
- **Input:** football-data.org matches JSON; static `assignments` map (people → 2 teams).
- **Does:**
  1. For each finished/in-play match, add `homeScore` to home team and `awayScore` to away team.
  2. Produce `teams[]`: `{ team, goals, matchesPlayed }`, sorted desc by goals.
  3. Produce `people[]`: `{ name, teams:[t1,t2], goals, breakdown:[g1,g2] }`, sorted desc.
  4. Derive `topMost` = first 10 of people, `topLeast` = last 10 (ascending).
  5. Emit `unmatchedTeams[]` — any assigned team name not found in the API feed (data-health flag).
  6. Write `public/data.json` with `{ updatedAt, teams, people, topMost, topLeast, unmatchedTeams }`.
- **Team-name normalization:** an alias map resolves family spellings to the API's names,
  e.g. `Czechia→Czech Republic`, `South Korea→Korea Republic`, `USA→United States`,
  `Côte d'Ivoire↔Ivory Coast`, `Cabo Verde↔Cape Verde`, `Türkiye↔Turkey`,
  `DR Congo↔Congo DR`, `Curaçao`, `Bosnia and Herzegovina`. Matching is
  accent/case-insensitive; anything still unresolved appears in `unmatchedTeams`.
- **Depends on:** `FOOTBALL_DATA_TOKEN` env var. No other runtime deps beyond fetch.

### 3.2 Scheduler (`.github/workflows/update.yml`)
- `schedule: cron` every 30 minutes + `workflow_dispatch` (manual run button).
- Runs the build script, commits `public/data.json` if changed, and triggers the Pages deploy.

### 3.3 Static site (`public/index.html`, `app.js`, `styles.css`)
- No framework; vanilla JS for speed and zero build. Fetches `data.json` on load.
- **Two tabs** (single page): **Teams** and **People**.
- Loud, friendly, mobile-first layout; large tap targets; works offline-ish (last data cached by browser).

## 4. UI / features

### Header (both tabs)
- Title + "Last updated: <relative time>" from `updatedAt`.
- **Search box** — filters the visible list live by name (person or team).

### Teams tab
- All 48 teams, ranked 1..n by goals: `Rank · Team · Goals · MP`.
- Leader row highlighted with 🏆.

### People tab (primary view for the sweepstake)
- **Full ranking** 1..31: `Rank · Name · Teams (2) · Combined goals`, with each team's
  individual goal contribution shown (e.g. `France 14 + South Africa 3`).
- **Top 10 most goals** section (the prize race) and **Top 10 least goals** section
  (the wooden-spoon race), each clearly headed.
- **⭐ Favourite your name:** tapping the star next to a name saves it in `localStorage`;
  the favourited person is pinned to the top of the People tab and visually highlighted,
  so each family member sees themselves first. Persists per device.

### Tie handling
- Equal goals share the same rank (e.g. two people on `12` are both rank `3`).
- Spec note for Simon: decide the real-world tie-break for the prize separately; the site
  just displays joint ranks.

## 5. Data: the 31 assignments (source of truth)

| Person | Team 1 | Team 2 |
|---|---|---|
| Sam | Argentina | Paraguay |
| Ken | Portugal | Curaçao |
| Ciara | England | Panama |
| Geoff | Morocco | Algeria |
| Emily | Portugal | Jordan |
| Sarah | Japan | Ghana |
| Ali | Spain | Uzbekistan |
| Christina | Uruguay | Uzbekistan |
| David | Japan | Czechia |
| Pete | France | South Africa |
| Scott | Colombia | Sweden |
| Anna | Iran | DR Congo |
| Johnny | Brazil | Ghana |
| Alice | Uruguay | New Zealand |
| Jenny | Türkiye | Cabo Verde |
| Laurie | Germany | Norway |
| Fergus | Mexico | Qatar |
| Finn | Switzerland | Iraq |
| Mel | Netherlands | Egypt |
| Áine | USA | Jordan |
| Patricia | Belgium | Sweden |
| Wendy | Senegal | Haiti |
| Jack | Germany | Curaçao |
| Dylan | Australia | Côte d'Ivoire |
| Stu | Netherlands | Tunisia |
| Matthew | USA | Scotland |
| Andrew | Ecuador | New Zealand |
| Dan | Austria | Saudi Arabia |
| Jason | South Korea | Qatar |
| Steven | South Korea | Bosnia and Herzegovina |
| Simon | Croatia | Canada |

Notes:
- Teams may be shared across people (e.g. Portugal, Germany, Uzbekistan, Sweden, Qatar,
  New Zealand, Jordan, Curaçao, USA, Netherlands, Uruguay, Japan, Ghana, South Korea).
  This is intended.
- Any assigned team not present in the live WC feed will surface in `unmatchedTeams` and
  show 0 goals until corrected (alias fix or reassignment).

## 6. Error handling

- **API failure / rate limit:** build script exits non-zero without overwriting a good
  `data.json`; the site keeps showing the last good data. Header time makes staleness visible.
- **Unmatched team names:** flagged in `unmatchedTeams`, optionally shown as a small admin
  note; never silently wrong.
- **No data yet (pre-fetch):** site shows a friendly "scores updating…" state.

## 7. Testing

- **Build script unit tests** with a fixed sample `matches.json` fixture:
  - goals aggregate correctly per team (home + away);
  - a person's combined total = sum of their two teams;
  - shared teams credit every owner;
  - alias normalization resolves the tricky names; unmatched names are reported;
  - top-10 most/least selection and joint-rank logic.
- **Manual check:** load the deployed page on a phone; verify search, favourite-pin, both tabs.

## 8. Deployment (one-time, ~5 min, user does)

1. Create a free **GitHub** repo and push this project.
2. Get a free **football-data.org** token; add as repo secret `FOOTBALL_DATA_TOKEN`.
3. Enable **GitHub Pages** (source: the `public/` output / Pages action).
4. Enable Actions; the cron then keeps `data.json` fresh automatically.
5. Share the resulting `https://<user>.github.io/<repo>` link in the group chat.

Claude builds everything above and provides exact click-by-click steps; Simon performs the
account-bound steps (2–4 require his GitHub login).

## 9. Out of scope (YAGNI)

- Live minute-by-minute push updates (30-min refresh is enough for a goals sweepstake).
- Accounts/auth, comments, notifications.
- xG, lineups, odds, per-player stats.
- Editing assignments through a UI (assignments are a static map in the repo).
