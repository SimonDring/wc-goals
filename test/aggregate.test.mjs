import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeName, resolveTeamKey, tallyTeamGoals, buildLeaderboard } from "../scripts/aggregate.mjs";

const sample = JSON.parse(
  readFileSync(new URL("./fixtures/matches.sample.json", import.meta.url))
);

test("normalizeName strips accents and lowercases", () => {
  assert.equal(normalizeName("Côte d'Ivoire"), "cote d'ivoire");
  assert.equal(normalizeName("Türkiye"), "turkiye");
  assert.equal(normalizeName("Curaçao"), "curacao");
  assert.equal(normalizeName("  USA "), "usa");
});

test("resolveTeamKey maps aliases to one canonical key", () => {
  assert.equal(resolveTeamKey("Czechia"), resolveTeamKey("Czech Republic"));
  assert.equal(resolveTeamKey("South Korea"), resolveTeamKey("Korea Republic"));
  assert.equal(resolveTeamKey("USA"), resolveTeamKey("United States"));
  assert.equal(resolveTeamKey("Côte d'Ivoire"), resolveTeamKey("Ivory Coast"));
  assert.equal(resolveTeamKey("Cabo Verde"), resolveTeamKey("Cape Verde"));
  assert.equal(resolveTeamKey("Türkiye"), resolveTeamKey("Turkey"));
  assert.equal(resolveTeamKey("DR Congo"), resolveTeamKey("Congo DR"));
  assert.equal(resolveTeamKey("France"), "france");
});

test("tallyTeamGoals sums home+away goals across played matches", () => {
  const t = tallyTeamGoals(sample.matches);
  assert.equal(t.get("france").goals, 4);
  assert.equal(t.get("france").matchesPlayed, 2);
  assert.equal(t.get(resolveTeamKey("South Korea")).goals, 2);
  assert.equal(t.get(resolveTeamKey("USA")).goals, 0);
  assert.equal(t.get(resolveTeamKey("USA")).matchesPlayed, 1);
  assert.equal(t.has("argentina"), false);
});

test("buildLeaderboard ranks people by combined goals with joint ranks", () => {
  const assignments = {
    Pete: ["France", "South Africa"],
    David: ["Japan", "Czechia"],
    Twin1: ["France", "South Africa"],
  };
  const data = buildLeaderboard(sample.matches, assignments);
  assert.equal(data.teams[0].team, "France");
  assert.equal(data.teams[0].goals, 4);
  const pete = data.people.find((p) => p.name === "Pete");
  assert.equal(pete.goals, 5);
  assert.deepEqual(pete.breakdown, [4, 1]);
  const twin = data.people.find((p) => p.name === "Twin1");
  assert.equal(pete.rank, 1);
  assert.equal(twin.rank, 1);
  assert.equal(data.people.find((p) => p.name === "David").rank, 3);
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
