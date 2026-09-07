export const PIGEON_SPEECH_WIDTH = 176;
export const PIGEON_SPEECH_HEIGHT = 60;
export const SCRIPTED_SPEECH_MS = 2200;

// Only the small, static bubble artwork moves. No native Text measurement or
// per-frame React render, and no rotation inherited from the pigeon's roll.
export function pigeonSpeechPresentation(w, visible, width, height, safeTop, safeBottom, size) {
  'worklet';
  const show = visible && !w.dead && w.px >= 0 && w.px <= width && w.py >= 0 && w.py <= height;
  const above = w.py - size * 0.35 - 10 - PIGEON_SPEECH_HEIGHT >= safeTop;
  const anchorY = w.py + (above ? -1 : 1) * size * 0.35;
  const x = Math.max(8, Math.min(width - PIGEON_SPEECH_WIDTH - 8, w.px - size * 0.1));
  const y = Math.max(safeTop, Math.min(height - safeBottom - PIGEON_SPEECH_HEIGHT - 8,
    above ? anchorY - 10 - PIGEON_SPEECH_HEIGHT : anchorY + 10));
  const bubbleEdge = above ? y + PIGEON_SPEECH_HEIGHT - 2 : y + 2;
  const tailLength = Math.max(1, Math.abs(bubbleEdge - anchorY));
  return {
    opacity: show ? 1 : 0, x, y,
    tailX: Math.max(x + 14, Math.min(x + PIGEON_SPEECH_WIDTH - 14, w.px + size * 0.25)) - 2,
    tailY: Math.min(anchorY, bubbleEdge) + tailLength / 2 - 0.5,
    tailLength,
  };
}

// Pauses stop calls to this function; speech survives a restart-cancel pause.
export function advanceScriptedSpeech(timerRef, dt, onExpired) {
  if (timerRef.current <= 0) return;
  timerRef.current = Math.max(0, timerRef.current - dt * 1000);
  if (timerRef.current < 0.000001) {
    timerRef.current = 0;
    onExpired();
  }
}
