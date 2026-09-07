import assert from 'node:assert/strict';

// A stale build-machine value must never override the production endpoint.
process.env.EXPO_PUBLIC_BACKEND_URL = 'https://stale-preview.invalid';

const { LeaderboardAPI, PRODUCTION_BACKEND_URL } = await import('../../leaderboard/api.js');

assert.equal(
  PRODUCTION_BACKEND_URL,
  'https://chip-pigeon.emergent.host',
  'production leaderboard host changed unexpectedly',
);

const calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  return {
    json: async () => ({ ok: true, top: [], you: null }),
  };
};

await LeaderboardAPI.top('player one', 'normal');
await LeaderboardAPI.top('player one', 'easy');

assert.deepEqual(calls, [
  'https://chip-pigeon.emergent.host/api/leaderboard/top?playerId=player%20one&mode=normal',
  'https://chip-pigeon.emergent.host/api/leaderboard/top?playerId=player%20one&mode=easy',
]);

console.log('PASS: release leaderboard requests use the stable DP production host for Global and Silly Mode');
