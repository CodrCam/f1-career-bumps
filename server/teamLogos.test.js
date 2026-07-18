import assert from 'node:assert/strict';
import test from 'node:test';
import { getTeamLogoConfig } from '../src/data/teamLogos.js';

test('resolves every current team to its 2026 identity', () => {
  const teams = [
    'Mercedes',
    'Ferrari',
    'McLaren',
    'Red Bull Racing',
    'Alpine',
    'Racing Bulls',
    'Haas F1 Team',
    'Williams',
    'Audi',
    'Aston Martin',
    'Cadillac',
  ];

  assert.equal(
    teams.filter((team) => !getTeamLogoConfig(team, 2026)).length,
    0,
  );
});

test('keeps the Sauber and Audi identities season-specific', () => {
  assert.equal(getTeamLogoConfig('Kick Sauber', 2025).key, 'kick-sauber');
  assert.equal(getTeamLogoConfig('Kick Sauber', 2026).key, 'audi');
  assert.equal(getTeamLogoConfig('Audi', 2025), null);
});

test('does not confuse Racing Bulls with Red Bull Racing', () => {
  assert.equal(getTeamLogoConfig('Racing Bulls', 2026).key, 'racing-bulls');
  assert.equal(getTeamLogoConfig('Red Bull Racing', 2026).key, 'red-bull-racing');
});

