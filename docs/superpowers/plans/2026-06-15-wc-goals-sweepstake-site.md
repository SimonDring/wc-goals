# World Cup 2026 Goals Sweepstake Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first, auto-updating hosted website that tallies every 2026 World Cup team's goals and ranks 31 family members by their two teams' combined goals, deployed on GitHub Pages.

**Architecture:** A Node build script fetches WC matches from football-data.org server-side, aggregates goals per team and per person, and writes `public/data.json`. A static vanilla-JS site in `public/` reads that JSON and renders Teams / People tabs with search and a favourite-your-name feature. A GitHub Actions cron runs the build every 30 minutes and deploys Pages.

**Tech Stack:** Node.js 20+ (built-in `fetch`, `node:test`, `node:assert` — zero npm dependencies), vanilla HTML/CSS/JS, GitHub Actions, GitHub Pages.

**Reference spec:** `docs/superpowers/specs/2026-06-15-wc-goals-sweepstake-site-design.md`

---

## File Structure

```
WC_Goals/
├── data/
│   └── assignments.json          # 31 people → 2 teams each (source of truth)
├── scripts/
│   ├── aggregate.mjs             # pure functions: normalize, tally, rank (testable, no I/O)
│   └── build-data.mjs            # I/O: fetch API → call aggregate → write public/data.json
├── test/
│   ├── fixtures/matches.sample.json   # fixed football-data.org-shaped sample
│   └── aggregate.test.mjs        # node:test unit tests for aggregate.mjs
├── public/
│   ├── index.html                # two-tab shell + header/search
│   ├── styles.css                # mobile-first styling
│   ├── app.js                    # fetch data.json, render, search, favourite
│   └── data.json                 # generated (committed; placeholder until first run)
├── .github/workflows/update.yml  # cron build + Pages deploy
├── .gitignore
└── README.md                     # deploy steps (the §8 click-by-click)
```

**Responsibilities:**
- `aggregate.mjs` — all pure logic (name normalization, goal tally, person sums, ranking, top-10s). No network, no fs → fully unit-testable.
- `build-data.mjs` — side effects only (fetch token call, read assignments, write file).
- `app.js` — rendering + browser state (localStorage favourite, search filter).

---

## Task 1: Project scaffold, git, assignments data

**Files:**
- Create: `.gitignore`, `data/assignments.json`, `package.json`

- [ ] **Step 1: Initialise git and Node project**

```bash
cd /Users/simondring/Code/WC_Goals
git init
```

Create `package.json`:

```json
{
  "name": "wc-goals",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "node scripts/build-data.mjs",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.env
.DS_Store
```

- [ ] **Step 3: Create `data/assignments.json`** (source of truth — exact spelling matters)

```json
{
  "Sam": ["Argentina", "Paraguay"],
  "Ken": ["Portugal", "Curaçao"],
  "Ciara": ["England", "Panama"],
  "Geoff": ["Morocco", "Algeria"],
  "Emily": ["Portugal", "Jordan"],
  "Sarah": ["Japan", "Ghana"],
  "Ali": ["Spain", "Uzbekistan"],
  "Christina": ["Uruguay", "Uzbekistan"],
  "David": ["Japan", "Czechia"],
  "Pete": ["France", "South Africa"],
  "Scott": ["Colombia", "Sweden"],
  "Anna": ["Iran", "DR Congo"],
  "Johnny": ["Brazil", "Ghana"],
  "Alice": ["Uruguay", "New Zealand"],
  "Jenny": ["Türkiye", "Cabo Verde"],
  "Laurie": ["Germany", "Norway"],
  "Fergus": ["Mexico", "Qatar"],
  "Finn": ["Switzerland", "Iraq"],
  "Mel": ["Netherlands", "Egypt"],
  "Áine": ["USA", "Jordan"],
  "Patricia": ["Belgium", "Sweden"],
  "Wendy": ["Senegal", "Haiti"],
  "Jack": ["Germany", "Curaçao"],
  "Dylan": ["Australia", "Côte d'Ivoire"],
  "Stu": ["Netherlands", "Tunisia"],
  "Matthew": ["USA", "Scotland"],
  "Andrew": ["Ecuador", "New Zealand"],
  "Dan": ["Austria", "Saudi Arabia"],
  "Jason": ["South Korea", "Qatar"],
  "Steven": ["South Korea", "Bosnia and Herzegovina"],
  "Simon": ["Croatia", "Canada"]
}
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json data/assignments.json
git commit -m "chore: scaffold project and family team assignments"
```

---

## Task 2: Team-name normalization (TDD)

**Files:**
- Create: `scripts/aggregate.mjs`
- Test: `test/aggregate.test.mjs`

- [ ] **Step 1: Write failing test for `normalizeName`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName } from "../scripts/aggregate.mjs";

test("normalizeName strips accents and lowercases", () => {
  assert.equal(normalizeName("Côte d'Ivoire"), "cote d'ivoire");
  assert.equal(normalizeName("Türkiye"), "turkiye");
  assert.equal(normalizeName("Curaçao"), "curacao");
  assert.equal(normalizeName("  USA "), "usa");
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test test/aggregate.test.mjs`
Expected: FAIL — `normalizeName` is not exported / not a function.

- [ ] **Step 3: Implement `normalizeName`**

```js
// scripts/aggregate.mjs
export function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .trim()
    .toLowerCase();
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test test/aggregate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/aggregate.mjs test/aggregate.test.mjs
git commit -m "feat: accent/case-insensitive team-name normalization"
```

---

## Task 3: Alias resolution to API team names (TDD)

**Files:**
- Modify: `scripts/aggregate.mjs`
- Test: `test/aggregate.test.mjs`

- [ ] **Step 1: Write failing test for `resolveTeamKey`**

`resolveTeamKey(name)` returns a canonical lookup key, applying aliases so family
spellings and API spellings collapse to the same key.

```js
import { resolveTeamKey } from "../scripts/aggregate.mjs";

test("resolveTeamKey maps aliases to one canonical key", () => {
  // family spelling and API spelling must collapse together
  assert.equal(resolveTeamKey("Czechia"), resolveTeamKey("Czech Republic"));
  assert.equal(resolveTeamKey("South Korea"), resolveTeamKey("Korea Republic"));
  assert.equal(resolveTeamKey("USA"), resolveTeamKey("United States"));
  assert.equal(resolveTeamKey("Côte d'Ivoire"), resolveTeamKey("Ivory Coast"));
  assert.equal(resolveTeamKey("Cabo Verde"), resolveTeamKey("Cape Verde"));
  assert.equal(resolveTeamKey("Türkiye"), resolveTeamKey("Turkey"));
  assert.equal(resolveTeamKey("DR Congo"), resolveTeamKey("Congo DR"));
  // a name with no alias just normalizes
  assert.equal(resolveTeamKey("France"), "france");
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test test/aggregate.test.mjs`
Expected: FAIL — `resolveTeamKey` not exported.

- [ ] **Step 3: Implement `resolveTeamKey` and alias map**

```js
// add to scripts/aggregate.mjs
// Each array lists spellings that mean the same team; first element is canonical display.
const ALIAS_GROUPS = [
  ["Czechia", "Czech Republic"],
  ["South Korea", "Korea Republic", "Korea, South"],
  ["USA", "United States", "United States of America", "USMNT"],
  ["Côte d'Ivoire", "Ivory Coast", "Cote d'Ivoire"],
  ["Cabo Verde", "Cape Verde"],
  ["Türkiye", "Turkey"],
  ["DR Congo", "Congo DR", "Democratic Republic of Congo", "DR Congo (Zaire)"],
];

// build: normalized spelling -> canonical normalized key
const ALIAS_LOOKUP = new Map();
for (const group of ALIAS_GROUPS) {
  const canonicalKey = normalizeName(group[0]);
  for (const spelling of group) {
    ALIAS_LOOKUP.set(normalizeName(spelling), canonicalKey);
  }
}

export function resolveTeamKey(name) {
  const norm = normalizeName(name);
  return ALIAS_LOOKUP.get(norm) ?? norm;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test test/aggregate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/aggregate.mjs test/aggregate.test.mjs
git commit -m "feat: alias map resolving family/API team spellings"
```

---

## Task 4: Tally goals per team from matches (TDD)

**Files:**
- Modify: `scripts/aggregate.mjs`
- Create: `test/fixtures/matches.sample.json`
- Test: `test/aggregate.test.mjs`

- [ ] **Step 1: Create the fixture** `test/fixtures/matches.sample.json`

Shaped like football-data.org `/v4/competitions/WC/matches`. Includes finished and
scheduled matches, a home and away spelling that needs aliasing, and a shared team.

```json
{
  "matches": [
    {
      "status": "FINISHED",
      "homeTeam": { "name": "France" },
      "awayTeam": { "name": "South Africa" },
      "score": { "fullTime": { "home": 3, "away": 1 } }
    },
    {
      "status": "FINISHED",
      "homeTeam": { "name": "Korea Republic" },
      "awayTeam": { "name": "Czech Republic" },
      "score": { "fullTime": { "home": 2, "away": 2 } }
    },
    {
      "status": "IN_PLAY",
      "homeTeam": { "name": "France" },
      "awayTeam": { "name": "United States" },
      "score": { "fullTime": { "home": 1, "away": 0 } }
    },
    {
      "status": "SCHEDULED",
      "homeTeam": { "name": "Argentina" },
      "awayTeam": { "name": "Paraguay" },
      "score": { "fullTime": { "home": null, "away": null } }
    }
  ]
}
```

- [ ] **Step 2: Write failing test for `tallyTeamGoals`**

Returns a Map keyed by canonical team key → `{ display, goals, matchesPlayed }`.
Counts FINISHED and IN_PLAY; ignores SCHEDULED; treats null scores as 0.

```js
import { readFileSync } from "node:fs";
import { tallyTeamGoals } from "../scripts/aggregate.mjs";

const sample = JSON.parse(
  readFileSync(new URL("./fixtures/matches.sample.json", import.meta.url))
);

test("tallyTeamGoals sums home+away goals across played matches", () => {
  const t = tallyTeamGoals(sample.matches);
  // France: 3 (vs RSA) + 1 (vs USA) = 4 over 2 matches
  assert.equal(t.get("france").goals, 4);
  assert.equal(t.get("france").matchesPlayed, 2);
  // Korea Republic canonical = south korea
  assert.equal(t.get(resolveTeamKey("South Korea")).goals, 2);
  // United States canonical = usa, conceded only -> 0 goals, 1 played
  assert.equal(t.get(resolveTeamKey("USA")).goals, 0);
  assert.equal(t.get(resolveTeamKey("USA")).matchesPlayed, 1);
  // SCHEDULED match contributes nothing
  assert.equal(t.has("argentina"), false);
});
```

Add `resolveTeamKey` to the existing import line at the top of the test file.

- [ ] **Step 3: Run test, verify it fails**

Run: `node --test test/aggregate.test.mjs`
Expected: FAIL — `tallyTeamGoals` not exported.

- [ ] **Step 4: Implement `tallyTeamGoals`**

```js
// add to scripts/aggregate.mjs
const PLAYED = new Set(["FINISHED", "IN_PLAY", "PAUSED"]);

export function tallyTeamGoals(matches) {
  const table = new Map();
  const bump = (rawName, goals) => {
    const key = resolveTeamKey(rawName);
    const row = table.get(key) ?? { display: rawName, goals: 0, matchesPlayed: 0 };
    row.goals += goals;
    row.matchesPlayed += 1;
    table.set(key, row);
  };
  for (const m of matches) {
    if (!PLAYED.has(m.status)) continue;
    const home = m.score?.fullTime?.home ?? 0;
    const away = m.score?.fullTime?.away ?? 0;
    bump(m.homeTeam.name, home);
    bump(m.awayTeam.name, away);
  }
  return table;
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `node --test test/aggregate.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/aggregate.mjs test/fixtures/matches.sample.json test/aggregate.test.mjs
git commit -m "feat: tally per-team goals from match feed"
```

---

## Task 5: People sums, ranking, top-10s, unmatched flags (TDD)

**Files:**
- Modify: `scripts/aggregate.mjs`
- Test: `test/aggregate.test.mjs`

- [ ] **Step 1: Write failing test for `buildLeaderboard`**

`buildLeaderboard(matches, assignments)` returns the full data payload.

```js
import { buildLeaderboard } from "../scripts/aggregate.mjs";

test("buildLeaderboard ranks people by combined goals with joint ranks", () => {
  const assignments = {
    Pete: ["France", "South Africa"],     // 4 + 1 = 5
    David: ["Japan", "Czechia"],          // 0 (japan unmatched) + 2 = 2
    Twin1: ["France", "South Africa"],    // 5 — ties Pete
  };
  const data = buildLeaderboard(sample.matches, assignments);

  // team rows sorted desc by goals
  assert.equal(data.teams[0].team, "France");
  assert.equal(data.teams[0].goals, 4);

  const pete = data.people.find((p) => p.name === "Pete");
  assert.equal(pete.goals, 5);
  assert.deepEqual(pete.breakdown, [4, 1]);

  // joint rank: Pete and Twin1 both rank 1
  const twin = data.people.find((p) => p.name === "Twin1");
  assert.equal(pete.rank, 1);
  assert.equal(twin.rank, 1);
  // next distinct person is rank 3 (1,1,3)
  assert.equal(data.people.find((p) => p.name === "David").rank, 3);

  // Japan never appears in sample matches -> flagged unmatched
  assert.ok(data.unmatchedTeams.includes("Japan"));
});

test("buildLeaderboard exposes top 10 most and least", () => {
  const assignments = Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => [`P${i}`, ["France", "South Africa"]])
  );
  const data = buildLeaderboard(sample.matches, assignments);
  assert.equal(data.topMost.length, 10);
  assert.equal(data.topLeast.length, 10);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test test/aggregate.test.mjs`
Expected: FAIL — `buildLeaderboard` not exported.

- [ ] **Step 3: Implement `buildLeaderboard`**

```js
// add to scripts/aggregate.mjs
function withRanks(sortedPeople) {
  let lastGoals = null;
  let lastRank = 0;
  return sortedPeople.map((p, i) => {
    const rank = p.goals === lastGoals ? lastRank : i + 1;
    lastGoals = p.goals;
    lastRank = rank;
    return { ...p, rank };
  });
}

export function buildLeaderboard(matches, assignments) {
  const table = tallyTeamGoals(matches);
  const goalsFor = (teamName) => table.get(resolveTeamKey(teamName))?.goals ?? 0;

  // team rows (every team that has appeared), sorted desc
  const teams = [...table.values()]
    .map((r) => ({ team: r.display, goals: r.goals, matchesPlayed: r.matchesPlayed }))
    .sort((a, b) => b.goals - a.goals || a.team.localeCompare(b.team));

  // unmatched: assigned teams never seen in the feed
  const seenKeys = new Set(table.keys());
  const unmatchedTeams = [];
  for (const pair of Object.values(assignments)) {
    for (const teamName of pair) {
      if (!seenKeys.has(resolveTeamKey(teamName)) && !unmatchedTeams.includes(teamName)) {
        unmatchedTeams.push(teamName);
      }
    }
  }

  const peopleSorted = Object.entries(assignments)
    .map(([name, pair]) => {
      const breakdown = pair.map(goalsFor);
      return { name, teams: pair, breakdown, goals: breakdown[0] + breakdown[1] };
    })
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  const people = withRanks(peopleSorted);
  const ascending = [...people].sort((a, b) => a.goals - b.goals || a.name.localeCompare(b.name));

  return {
    updatedAt: new Date().toISOString(),
    teams,
    people,
    topMost: people.slice(0, 10),
    topLeast: ascending.slice(0, 10),
    unmatchedTeams,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test test/aggregate.test.mjs`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/aggregate.mjs test/aggregate.test.mjs
git commit -m "feat: people leaderboard, joint ranks, top-10s, unmatched flags"
```

---

## Task 6: Build script — fetch + write data.json

**Files:**
- Create: `scripts/build-data.mjs`, `public/data.json` (placeholder)

- [ ] **Step 1: Implement `scripts/build-data.mjs`**

```js
// scripts/build-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildLeaderboard } from "./aggregate.mjs";

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const API = "https://api.football-data.org/v4/competitions/WC/matches";
const OUT = new URL("../public/data.json", import.meta.url);

async function main() {
  if (!TOKEN) throw new Error("FOOTBALL_DATA_TOKEN env var is required");

  const assignments = JSON.parse(
    readFileSync(new URL("../data/assignments.json", import.meta.url))
  );

  const res = await fetch(API, { headers: { "X-Auth-Token": TOKEN } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const { matches } = await res.json();

  const data = buildLeaderboard(matches, assignments);

  mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");

  console.log(
    `Wrote ${data.teams.length} teams, ${data.people.length} people. ` +
      `Unmatched: ${data.unmatchedTeams.join(", ") || "none"}.`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1); // non-zero: workflow keeps last good data.json
});
```

- [ ] **Step 2: Create placeholder `public/data.json`** (so the site renders before the first run)

```json
{
  "updatedAt": null,
  "teams": [],
  "people": [],
  "topMost": [],
  "topLeast": [],
  "unmatchedTeams": []
}
```

- [ ] **Step 3: Manual smoke test (optional, needs a token)**

Run: `FOOTBALL_DATA_TOKEN=xxxx npm run build`
Expected: prints a summary line and overwrites `public/data.json`.
If no token yet, skip — the GitHub Action will run it.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-data.mjs public/data.json
git commit -m "feat: build script fetches WC matches and writes data.json"
```

---

## Task 7: Static site — HTML shell + styling

**Files:**
- Create: `public/index.html`, `public/styles.css`

- [ ] **Step 1: Create `public/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>⚽ WC 2026 Goals Sweepstake</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <h1>⚽ WC 2026 Goals Sweepstake</h1>
    <p id="updated" class="updated">Loading…</p>
    <input id="search" type="search" placeholder="Search a name or team…" autocomplete="off" />
    <nav class="tabs">
      <button data-tab="people" class="active">People</button>
      <button data-tab="teams">Teams</button>
    </nav>
  </header>

  <main>
    <section id="people" class="tab active">
      <h2>🏆 Top 10 — most goals</h2>
      <ol id="top-most" class="board"></ol>
      <h2>🥄 Top 10 — fewest goals</h2>
      <ol id="top-least" class="board"></ol>
      <h2>Everyone</h2>
      <ol id="people-all" class="board"></ol>
    </section>

    <section id="teams" class="tab">
      <h2>Teams by goals</h2>
      <ol id="teams-all" class="board"></ol>
    </section>
  </main>

  <p id="unmatched" class="unmatched"></p>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/styles.css`** (mobile-first, big tap targets)

```css
:root { --bg:#0b132b; --card:#1c2541; --accent:#3a86ff; --gold:#ffd166; --text:#f2f4f8; --muted:#9aa5c4; }
* { box-sizing: border-box; }
body { margin:0; font-family:system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--text); }
header { position:sticky; top:0; background:var(--bg); padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.4); z-index:10; }
h1 { font-size:1.25rem; margin:0 0 4px; }
.updated { margin:0 0 12px; color:var(--muted); font-size:.8rem; }
#search { width:100%; padding:12px; font-size:1rem; border:none; border-radius:10px; margin-bottom:12px; }
.tabs { display:flex; gap:8px; }
.tabs button { flex:1; padding:12px; font-size:1rem; border:none; border-radius:10px; background:var(--card); color:var(--text); }
.tabs button.active { background:var(--accent); font-weight:700; }
main { padding:16px; }
h2 { font-size:1rem; color:var(--muted); margin:20px 0 8px; }
.tab { display:none; }
.tab.active { display:block; }
.board { list-style:none; margin:0; padding:0; }
.board li { display:flex; align-items:center; gap:10px; background:var(--card); padding:12px; border-radius:10px; margin-bottom:8px; }
.board li.fav { outline:2px solid var(--gold); }
.board li.leader { background:linear-gradient(90deg,#2a3a6b,#1c2541); }
.rank { width:2ch; text-align:right; color:var(--muted); font-variant-numeric:tabular-nums; }
.name { font-weight:700; }
.sub { color:var(--muted); font-size:.8rem; }
.goals { margin-left:auto; font-size:1.4rem; font-weight:800; font-variant-numeric:tabular-nums; }
.star { cursor:pointer; background:none; border:none; font-size:1.2rem; opacity:.4; }
.star.on { opacity:1; }
.hidden { display:none; }
.unmatched { padding:0 16px 24px; color:var(--muted); font-size:.75rem; }
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/styles.css
git commit -m "feat: mobile-first site shell and styling"
```

---

## Task 8: Site behaviour — render, tabs, search, favourite

**Files:**
- Create: `public/app.js`

- [ ] **Step 1: Implement `public/app.js`**

```js
const FAV_KEY = "wc-goals-fav";
const $ = (sel) => document.querySelector(sel);

function favName() { return localStorage.getItem(FAV_KEY) || ""; }
function setFav(name) {
  if (favName() === name) localStorage.removeItem(FAV_KEY);
  else localStorage.setItem(FAV_KEY, name);
}

function timeAgo(iso) {
  if (!iso) return "not updated yet";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

function personLi(p, { showStar = true } = {}) {
  const li = document.createElement("li");
  li.dataset.search = (p.name + " " + p.teams.join(" ")).toLowerCase();
  if (p.name === favName()) li.classList.add("fav");
  li.innerHTML = `
    <span class="rank">${p.rank}</span>
    <span>
      <span class="name">${p.name}</span><br>
      <span class="sub">${p.teams[0]} ${p.breakdown[0]} + ${p.teams[1]} ${p.breakdown[1]}</span>
    </span>
    <span class="goals">${p.goals}</span>
    ${showStar ? `<button class="star ${p.name === favName() ? "on" : ""}" title="Favourite">★</button>` : ""}`;
  const star = li.querySelector(".star");
  if (star) star.addEventListener("click", () => { setFav(p.name); render(window.__data); });
  return li;
}

function teamLi(t, i) {
  const li = document.createElement("li");
  li.dataset.search = t.team.toLowerCase();
  if (i === 0 && t.goals > 0) li.classList.add("leader");
  li.innerHTML = `
    <span class="rank">${i + 1}</span>
    <span><span class="name">${i === 0 && t.goals > 0 ? "🏆 " : ""}${t.team}</span><br>
      <span class="sub">${t.matchesPlayed} played</span></span>
    <span class="goals">${t.goals}</span>`;
  return li;
}

function fill(ol, items, fn) {
  ol.replaceChildren();
  items.forEach((it, i) => ol.appendChild(fn(it, i)));
}

function render(data) {
  window.__data = data;
  $("#updated").textContent = "Updated " + timeAgo(data.updatedAt);

  // pin favourite to the top of "Everyone"
  const fav = favName();
  const everyone = [...data.people].sort((a, b) =>
    (b.name === fav) - (a.name === fav) || a.rank - b.rank);

  fill($("#top-most"), data.topMost, (p) => personLi(p));
  fill($("#top-least"), data.topLeast, (p) => personLi(p));
  fill($("#people-all"), everyone, (p) => personLi(p));
  fill($("#teams-all"), data.teams, teamLi);

  $("#unmatched").textContent = data.unmatchedTeams.length
    ? `Note: no live data yet for ${data.unmatchedTeams.join(", ")} (showing 0).`
    : "";
  applySearch();
}

function applySearch() {
  const q = $("#search").value.trim().toLowerCase();
  document.querySelectorAll(".board li").forEach((li) => {
    li.classList.toggle("hidden", q && !li.dataset.search.includes(q));
  });
}

function initTabs() {
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      $("#" + btn.dataset.tab).classList.add("active");
    });
  });
}

$("#search").addEventListener("input", applySearch);
initTabs();
fetch("data.json")
  .then((r) => r.json())
  .then(render)
  .catch(() => { $("#updated").textContent = "Could not load scores."; });
```

- [ ] **Step 2: Manual test in a browser**

Run: `python3 -m http.server 8000 --directory public`
Open: `http://localhost:8000` on a phone-sized viewport.
Verify: tabs switch; typing in search filters lists; clicking ★ pins a name to the top of
"Everyone" and persists after refresh. (Lists are empty until a real `data.json` exists —
to see content, temporarily paste sample rows or run Task 6 with a token.)

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: render leaderboard with tabs, search, favourite pin"
```

---

## Task 9: GitHub Actions — scheduled build + Pages deploy

**Files:**
- Create: `.github/workflows/update.yml`

- [ ] **Step 1: Create `.github/workflows/update.yml`**

```yaml
name: Update goals & deploy

on:
  schedule:
    - cron: "*/30 * * * *"   # every 30 minutes
  workflow_dispatch: {}       # manual "Run now" button
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Run tests
        run: node --test
      - name: Build data.json
        env:
          FOOTBALL_DATA_TOKEN: ${{ secrets.FOOTBALL_DATA_TOKEN }}
        run: node scripts/build-data.mjs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/update.yml
git commit -m "ci: scheduled build and GitHub Pages deploy"
```

---

## Task 10: README with deploy steps

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** (the §8 click-by-click, exact)

````markdown
# ⚽ WC 2026 Goals Sweepstake

Auto-updating leaderboard: every team's World Cup goals, and each family member's two
teams combined. Hosted free on GitHub Pages, refreshed every 30 minutes.

## One-time deploy (~5 min)

1. **Create a GitHub repo** and push this folder:
   ```bash
   git remote add origin https://github.com/<you>/wc-goals.git
   git push -u origin main
   ```
2. **Get a free API token** at https://www.football-data.org/client/register
   → confirm email → copy the token.
3. **Add the token as a secret:** repo → Settings → Secrets and variables → Actions →
   *New repository secret* → name `FOOTBALL_DATA_TOKEN`, paste the token.
4. **Enable Pages:** repo → Settings → Pages → Source = **GitHub Actions**.
5. **Run it:** repo → Actions → *Update goals & deploy* → **Run workflow**.
   When it finishes, your link is at the top of the Pages settings:
   `https://<you>.github.io/wc-goals` — share that in the chat.

After this, the cron updates scores automatically; no further action needed.

## Local preview
```bash
python3 -m http.server 8000 --directory public   # then open http://localhost:8000
FOOTBALL_DATA_TOKEN=xxxx npm run build            # refresh data.json locally
npm test                                          # run unit tests
```

## Changing assignments
Edit `data/assignments.json` (name → two team spellings) and push. If a team shows 0 with a
"no live data yet" note, its spelling didn't match the feed — add an alias in the
`ALIAS_GROUPS` list in `scripts/aggregate.mjs`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: deploy and maintenance instructions"
```

---

## Self-Review Notes (completed)

- **Spec coverage:** data source (Task 6), normalization/aliases (Tasks 2–3), team tally
  (Task 4), people sums + joint ranks + top-10s + unmatched flags (Task 5), two-tab mobile
  site + search + favourite (Tasks 7–8), 30-min cron + Pages (Task 9), deploy README/§8
  (Task 10), all 31 assignments (Task 1). Error handling: build exits non-zero to preserve
  last good data (Task 6); unmatched flagged (Tasks 5, 8); empty-data placeholder (Task 6).
- **Placeholder scan:** none — all steps contain runnable code/commands.
- **Type consistency:** `resolveTeamKey`, `normalizeName`, `tallyTeamGoals` (→ Map of
  `{display,goals,matchesPlayed}`), `buildLeaderboard` (→ `{updatedAt,teams,people,topMost,
  topLeast,unmatchedTeams}`), and `data.json` shape match across build script, tests, and
  `app.js`.
- **Tie-break for the actual prize** is intentionally a human decision (spec §4); the site
  shows joint ranks.
