export const HECKLER_WINDOW = 36;
export const HECKLER_BUBBLE_WIDTH = 176;
export const HECKLER_BUBBLE_HEIGHT = 60;

// One source of visibility for the person, connector and speech. Runs on the UI
// thread; it never polls a shared value from JavaScript or measures native text.
export function hecklerPresentation(snapshot, eventId, width, safeTop) {
  'worklet';
  const h = snapshot.heckler;
  const visible = !snapshot.dead && h && h.active && h.id === eventId && h.life > 0
    && h.x - HECKLER_WINDOW / 2 >= 0 && h.x + HECKLER_WINDOW / 2 <= width;
  const x = visible ? h.x - HECKLER_WINDOW / 2 : -999;
  const y = visible ? h.y - HECKLER_WINDOW / 2 : -999;
  const above = y - HECKLER_BUBBLE_HEIGHT - 8 >= safeTop;
  return {
    opacity: visible ? Math.min(1, h.life / 0.35) : 0,
    windowX: x,
    windowY: y,
    bubbleX: Math.max(8, Math.min(width - HECKLER_BUBBLE_WIDTH - 8, x + HECKLER_WINDOW / 2 - HECKLER_BUBBLE_WIDTH / 2)),
    bubbleY: above ? y - HECKLER_BUBBLE_HEIGHT - 8 : y + HECKLER_WINDOW + 8,
    connectorX: x + HECKLER_WINDOW / 2 - 2,
    connectorY: above ? y - 8 : y + HECKLER_WINDOW,
  };
}

// Fixed three-line SVG topology. Called only when a new insult is selected.
export function wrapHecklerInsult(text) {
  const lines = [''];
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    const i = lines.length - 1;
    const candidate = lines[i] ? `${lines[i]} ${word}` : word;
    if (candidate.length > 20 && lines[i] && lines.length < 3) lines.push(word);
    else lines[i] = candidate;
  }
  while (lines.length < 3) lines.push('');
  return lines;
}
