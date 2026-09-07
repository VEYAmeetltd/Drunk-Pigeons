package com.intiesltd.drunkpigeons.effects;

import android.annotation.TargetApi;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.os.Build;
import java.util.WeakHashMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

/** A normal RN scene container with an optional Android 12+ GPU blur. */
@ReactModule(name = DPBeerWorldManager.NAME)
public final class DPBeerWorldManager extends ReactViewManager {
  public static final String NAME = "DPBeerWorld";
  private final WeakHashMap<ReactViewGroup, Float> requestedRadii = new WeakHashMap<>();

  @Override
  public String getName() { return NAME; }

  @ReactProp(name = "beerBlurRadius", defaultFloat = 0f)
  public void setBeerBlurRadius(ReactViewGroup view, float radius) {
    if (radius > 0f && !Float.isNaN(radius) && !Float.isInfinite(radius)) {
      requestedRadii.put(view, Math.min(radius, 10f));
    } else {
      requestedRadii.remove(view);
    }
  }

  @Override
  protected void onAfterUpdateTransaction(ReactViewGroup view) {
    // RN 0.81 BaseViewManager clears RenderEffect in its layer/filter update,
    // even when no filter prop is present. Apply our scene effect AFTER that
    // update, not in the prop setter where RN would immediately erase it.
    super.onAfterUpdateTransaction(view);
    if (Build.VERSION.SDK_INT >= 31) {
      Float radius = requestedRadii.get(view);
      Api31.apply(view, radius == null ? 0f : radius);
    }
  }

  @Override
  public void onDropViewInstance(ReactViewGroup view) {
    requestedRadii.remove(view);
    if (Build.VERSION.SDK_INT >= 31) Api31.apply(view, 0f);
    super.onDropViewInstance(view);
  }

  // Keep newer API types in a guarded class so older Android versions retain
  // the normal scene and the existing pigeon wobble without loading RenderEffect.
  @TargetApi(31)
  private static final class Api31 {
    private static final RenderEffect[] effects = new RenderEffect[2];
    private static final float[] radiiPx = new float[2];
    private static int nextSlot;

    static void apply(ReactViewGroup view, float radius) {
      if (!(radius > 0f)) {
        view.setRenderEffect(null);
        return;
      }
      float px = PixelUtil.toPixelFromDIP(Math.min(radius, 10f));
      RenderEffect effect = null;
      for (int i = 0; i < effects.length; i++) {
        if (effects[i] != null && radiiPx[i] == px) { effect = effects[i]; break; }
      }
      if (effect == null) {
        effect = RenderEffect.createBlurEffect(px, px, Shader.TileMode.CLAMP);
        effects[nextSlot] = effect;
        radiiPx[nextSlot] = px;
        nextSlot = (nextSlot + 1) % effects.length;
      }
      // Blurs this scene's existing render node. No screen capture, CPU bitmap,
      // duplicate world, colour overlay, or per-frame JS/native calls.
      view.setRenderEffect(effect);
    }
  }
}
