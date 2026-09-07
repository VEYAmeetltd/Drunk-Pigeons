package com.intiesltd.drunkpigeons.effects;

import android.annotation.TargetApi;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.SoundPool;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One preloaded pool for the app; no decoding or file IO in play(). */
@ReactModule(name = DPGameAudioModule.NAME)
public final class DPGameAudioModule extends ReactContextBaseJavaModule
    implements LifecycleEventListener, AudioManager.OnAudioFocusChangeListener {
  public static final String NAME = "DPGameAudio";
  private static final int MAX_STREAMS = 8;
  private static final String[] SOUNDS = {
    "flap", "chip", "crash", "ui", "highscore", "revive", "pop", "pint", "leet",
    "sig_stagger", "sig_nap", "sig_nahgood", "sig_salute", "sig_rep", "sig_lost", "sig_gentleman"
  };
  private final ExecutorService loader = Executors.newSingleThreadExecutor(r -> new Thread(r, "DPSoundLoader"));
  private final Map<String, Integer> samples = new HashMap<>();
  private final Set<Integer> loaded = new HashSet<>();
  private final int[] streams = new int[MAX_STREAMS];
  private final AudioManager audioManager;
  private final AudioAttributes attributes = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
  private Object focusRequest;
  private SoundPool pool;
  private boolean preparing;
  private boolean enabled = true;
  private boolean foreground = true;
  private boolean focusGranted;
  private boolean focusInterrupted;
  private boolean invalidated;
  private int nextStream;

  public DPGameAudioModule(ReactApplicationContext context) {
    super(context);
    audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) focusRequest = Api26.create(this, attributes);
    context.addLifecycleEventListener(this);
  }

  @Override public String getName() { return NAME; }

  @ReactMethod public synchronized void prepare() {
    if (invalidated || preparing || pool != null) return;
    preparing = true;
    loader.execute(this::loadSamples);
  }

  private void loadSamples() {
    SoundPool created = null;
    try {
      created = new SoundPool.Builder().setMaxStreams(MAX_STREAMS).setAudioAttributes(attributes).build();
      final SoundPool owner = created;
      created.setOnLoadCompleteListener((finishedPool, id, status) -> {
        synchronized (DPGameAudioModule.this) {
          if (pool != owner || invalidated) return;
          if (status == 0) loaded.add(id);
          else Log.e(NAME, "Sound sample failed to preload: " + id + " (" + status + ")");
        }
      });
      synchronized (this) {
        if (invalidated) { created.release(); return; }
        pool = created;
      }
      for (String sound : SOUNDS) {
        // AAPT stores these bundled WAVs uncompressed. SoundPool performs the
        // decoding asynchronously; this worker only opens and submits each file.
        try (AssetFileDescriptor file = getReactApplicationContext().getAssets().openFd("dp_sfx/" + sound + ".wav")) {
          synchronized (this) {
            if (pool != owner || invalidated) return;
            int id = owner.load(file, 1);
            if (id > 0) samples.put(sound, id);
            else Log.e(NAME, "Could not queue sound: " + sound);
          }
        } catch (IOException | RuntimeException error) {
          Log.e(NAME, "Could not preload sound: " + sound, error);
        }
      }
    } catch (RuntimeException error) {
      Log.e(NAME, "SoundPool initialization failed", error);
      synchronized (this) {
        if (pool == created) { pool = null; samples.clear(); loaded.clear(); }
      }
      if (created != null) created.release();
    } finally {
      synchronized (this) { preparing = false; }
    }
  }

  @ReactMethod public synchronized void setEnabled(boolean value) {
    enabled = value;
    if (value) focusInterrupted = false;
    if (!value) { stopStreams(); abandonFocus(); }
  }

  @ReactMethod public synchronized void play(String sound) {
    if (invalidated || !enabled || !foreground || focusInterrupted || pool == null) return;
    Integer sample = samples.get(sound);
    if (sample == null || !loaded.contains(sample)) return; // never play a delayed backlog of taps
    if (!focusGranted && !requestFocus()) return;
    // SoundPool bounds simultaneous streams. Track only these eight so mute,
    // ads/backgrounding and teardown can stop them without a growing list.
    if (streams[nextStream] != 0) pool.stop(streams[nextStream]);
    streams[nextStream] = pool.play(sample, 1f, 1f, 1, 0, 1f);
    nextStream = (nextStream + 1) % MAX_STREAMS;
  }

  @SuppressWarnings("deprecation") private boolean requestFocus() {
    if (audioManager == null) return false;
    int result = Build.VERSION.SDK_INT >= 26
        ? Api26.request(audioManager, focusRequest)
        : audioManager.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
    focusGranted = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    return focusGranted;
  }

  @SuppressWarnings("deprecation") private void abandonFocus() {
    focusGranted = false;
    if (audioManager == null) return;
    if (Build.VERSION.SDK_INT >= 26) Api26.abandon(audioManager, focusRequest);
    else audioManager.abandonAudioFocus(this);
  }

  private void stopStreams() {
    for (int i = 0; i < streams.length; i++) {
      if (pool != null && streams[i] != 0) pool.stop(streams[i]);
      streams[i] = 0;
    }
    nextStream = 0;
  }

  @Override public synchronized void onAudioFocusChange(int change) {
    if (change == AudioManager.AUDIOFOCUS_GAIN) {
      focusInterrupted = false;
      focusGranted = enabled && foreground;
    } else {
      focusInterrupted = true; // don't reclaim an ad/call's focus on a background signature sound
      focusGranted = false;
      stopStreams();
    }
  }
  @Override public synchronized void onHostResume() { foreground = true; focusInterrupted = false; }
  @Override public synchronized void onHostPause() { foreground = false; stopStreams(); abandonFocus(); }
  @Override public synchronized void onHostDestroy() { onHostPause(); }
  @Override public synchronized void invalidate() {
    if (invalidated) return;
    invalidated = true;
    onHostPause();
    getReactApplicationContext().removeLifecycleEventListener(this);
    if (pool != null) { pool.release(); pool = null; }
    samples.clear(); loaded.clear();
    loader.shutdownNow();
    super.invalidate();
  }

  @TargetApi(26) private static final class Api26 {
    static Object create(AudioManager.OnAudioFocusChangeListener listener, AudioAttributes attributes) {
      return new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
          .setAudioAttributes(attributes)
          .setOnAudioFocusChangeListener(listener, new Handler(Looper.getMainLooper())).build();
    }
    static int request(AudioManager manager, Object request) { return manager.requestAudioFocus((AudioFocusRequest) request); }
    static void abandon(AudioManager manager, Object request) { manager.abandonAudioFocusRequest((AudioFocusRequest) request); }
  }
}
