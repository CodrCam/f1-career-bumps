import test from "node:test";
import assert from "node:assert/strict";

import {
  TEAM_COLORS,
  getDriverColor,
  normalizeDriverTeamFields,
} from "../src/utils/dataProcessing.js";
import { getTeamCarConfig } from "../src/data/seasonGrid.js";

test("2026 team palette keeps similar liveries visually distinct", () => {
  assert.equal(TEAM_COLORS.Audi, "#929CAA");
  assert.equal(TEAM_COLORS.Cadillac, "#D9AD3A");
  assert.equal(TEAM_COLORS.Williams, "#47A7FF");
  assert.notEqual(TEAM_COLORS.Williams, TEAM_COLORS["Red Bull Racing"]);
  assert.notEqual(TEAM_COLORS.Audi, TEAM_COLORS.Haas);
});

test("Sauber stays green historically and becomes Audi silver in 2026", () => {
  const driver = {
    full_name: "Nico Hulkenberg",
    team_name: "Kick Sauber",
    team_colour: "00F500",
  };

  const [historical] = normalizeDriverTeamFields([driver], 2025);
  const [current] = normalizeDriverTeamFields([driver], 2026);

  assert.equal(historical.team_name, "Kick Sauber");
  assert.equal(historical.team_colour, "00F500");
  assert.equal(current.team_name, "Audi");
  assert.equal(current.team_colour, "929CAA");
  assert.equal(getDriverColor("Nico Hulkenberg", "Kick Sauber", 2025), "#00F500");
  assert.equal(getDriverColor("Nico Hulkenberg", "Kick Sauber", 2026), "#AEB7C4");
  assert.equal(getTeamCarConfig("audi", 2025).name, "Kick Sauber");
  assert.equal(getTeamCarConfig("audi", 2026).name, "Audi");
});
