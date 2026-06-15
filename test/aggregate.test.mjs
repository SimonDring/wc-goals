import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, resolveTeamKey } from "../scripts/aggregate.mjs";

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
