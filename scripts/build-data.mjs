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
