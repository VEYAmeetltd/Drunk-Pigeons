import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PIGEONS } from '../../data/pigeons.js';

const byId = Object.fromEntries(PIGEONS.map((p) => [p.id, p]));

assert.equal(PIGEONS.length, 7, 'all seven existing pigeons must remain present');
assert.deepEqual(
  Object.keys(byId).sort(),
  ['business', 'classic', 'fancy', 'gym', 'king', 'roadman', 'tourist'],
  'profile work must not add, remove or rename gameplay pigeon IDs'
);

assert.equal(byId.classic.profileName, 'Frank');
assert.equal(byId.classic.profileStory, 'This is Frank');
assert.equal(byId.business.profileName, 'Masta Damo');
assert.equal(byId.gym.profileName, 'Shumbies');
assert.equal(byId.fancy.profileName, 'Claireiosa');
assert.equal(byId.king.profileName, 'ShArpClAw');
assert.equal(byId.roadman.profileName, 'DeathRoad');
assert.equal(byId.roadman.profileStory, "I'll lay you out bruv...........in C.O.D");
assert.equal(byId.tourist.profileStory, 'He travels so much he changes his name as he pleases');
assert.equal(byId.tourist.profileAliases.length, 3);

for (const pigeon of PIGEONS) {
  assert.ok(pigeon.profileName, `${pigeon.id} needs a profile name`);
  assert.ok(pigeon.profileStory, `${pigeon.id} needs profile copy`);
}

const screen = fs.readFileSync(new URL('../../screens/PigeonsScreen.js', import.meta.url), 'utf8');
assert.match(screen, /testID={`pigeon-info-\${p\.id}`}/, 'every roster card needs its own info control');
assert.match(screen, /event\.stopPropagation\(\)/, 'opening a profile must not also activate the parent card');
assert.match(screen, /testID="pigeon-profile-overlay"/, 'profile overlay must stay mounted behind a single state gate');
assert.match(screen, /testID="pigeon-profile-close"/, 'profile overlay needs an explicit close control');
assert.match(screen, /profile\.profileAliases\.map/, 'Tourist aliases must render from bounded profile data');

console.log('PASS: all seven pigeon info cards, exact identities, protected card interaction, profile close and Tourist aliases verified');
