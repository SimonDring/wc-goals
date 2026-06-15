import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName } from "../scripts/aggregate.mjs";

test("normalizeName strips accents and lowercases", () => {
  assert.equal(normalizeName("Côte d'Ivoire"), "cote d'ivoire");
  assert.equal(normalizeName("Türkiye"), "turkiye");
  assert.equal(normalizeName("Curaçao"), "curacao");
  assert.equal(normalizeName("  USA "), "usa");
});
