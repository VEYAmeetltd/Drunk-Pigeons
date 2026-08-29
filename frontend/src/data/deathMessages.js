// Reusable death-message system. Add more messages here any time.
const MESSAGES = [
  "Shouldn't have had that last pint.",
  'Gravity wins again.',
  'Absolute state of you.',
  'That lamp post came out of nowhere.',
  'Maybe walk home next time.',
  'Too many chips.',
  'Flight privileges revoked.',
  'Peak pigeon behaviour.',
  'Down goes another one.',
  'Tried its best. Its best was poor.',
  'Should have got the bus.',
  'Wings were more of a suggestion.',
  'Certified ground pigeon now.',
  'One chip too far.',
  'The pavement was undefeated.',
];

let lastIndex = -1;

export function randomDeathMessage() {
  if (MESSAGES.length === 1) return MESSAGES[0];
  let i = Math.floor(Math.random() * MESSAGES.length);
  if (i === lastIndex) i = (i + 1) % MESSAGES.length;
  lastIndex = i;
  return MESSAGES[i];
}

export function addDeathMessage(msg) {
  if (msg && typeof msg === 'string') MESSAGES.push(msg);
}
