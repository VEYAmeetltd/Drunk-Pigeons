export const BEER_BLUR_DP = 9;
export function sceneBlurRadius(level = 0, beerActive = false) {
  if (beerActive) return BEER_BLUR_DP;
  const amount = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  return 4 * amount * amount;
}

// Exercise the native effect while still in READY, then clear it before enabling
// the first gameplay tap. Uses rendered-frame opportunities, not a long timer.
// The owner cancels this work when the screen unmounts.
export function prepareBeerRenderer(requestFrame, cancelFrame, clearPreview, onPrepared) {
  let active = true;
  let frame = 0;
  let id;
  const tick = () => {
    if (!active) return;
    frame++;
    if (frame === 4) clearPreview();
    if (frame === 6) {
      active = false;
      onPrepared();
      return;
    }
    id = requestFrame(tick);
  };
  id = requestFrame(tick);
  return () => {
    active = false;
    cancelFrame(id);
  };
}
