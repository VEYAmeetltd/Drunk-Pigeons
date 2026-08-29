// Reusable pool of mildly-rude, absurd, British pigeon insults shouted by
// window people. Swearing is censored with symbols. Add more freely.
const INSULTS = [
  '$%&! YOU, PIGEON!',
  'FLY STRAIGHT, YA $%&!',
  'GET LOST, YOU FEATHERY $%&!',
  'NOT ON MY WINDOW!',
  'OI! $%& OFF!',
  'YOU AGAIN?!',
  'ABSOLUTE STATE OF YOU!',
  "GO HOME, YOU'RE DRUNK!",
  'USE THE PAVEMENT!',
  'MY CHIPS! $%& OFF!',
  'DISGUSTING $%&!',
  'I JUST CLEANED THAT!',
  "WATCH WHERE YOU'RE FLYING!",
  'GET A JOB!',
  "THAT'S MY ROOF!",
  'YOU FAT $%&!',
  'NOT THE PUB AGAIN!',
  "I'M CALLING THE COUNCIL!",
  'STOP STARING AT MY CHIPS!',
  'FLY SOMEWHERE ELSE!',
  'CHEEKY LITTLE $%&!',
  'BOG OFF, BINBRAIN!',
  'NO PIGEONS! CAN YOU READ?!',
  'MENACE OF THE SKIES!',
  'SLING YER HOOK, $%&!',
  'RIGHT, THAT DOES IT!',
  'YOU WINGED $%&!',
  'GERROUT OF IT!',
  'HAVE SOME RESPECT!',
  'MENACE! UTTER MENACE!',
];

// A few lightweight reaction poses for the window person.
export const REACTIONS = ['fist', 'point', 'horrified', 'mug', 'newspaper', 'wave', 'confused'];

let lastInsult = -1;

export function pickInsult(r) {
  let i = Math.floor((r ?? Math.random()) * INSULTS.length) % INSULTS.length;
  if (i === lastInsult && INSULTS.length > 1) i = (i + 1) % INSULTS.length;
  lastInsult = i;
  return INSULTS[i];
}

export function pickReaction(r) {
  const i = Math.floor((r ?? Math.random()) * REACTIONS.length) % REACTIONS.length;
  return REACTIONS[i];
}

export function addInsult(line) {
  if (line && typeof line === 'string') INSULTS.push(line);
}
