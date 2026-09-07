import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

// Only mounted during native cold-start intro. Unmount releases the video player.
export default function IntroScreen({ soundEnabled, onDone }) {
  const insets = useSafeAreaInsets();
  const finished = useRef(false);
  const player = useVideoPlayer(require('../../assets/video/dp-intro.mp4'), p => {
    p.loop = false;
    p.muted = !soundEnabled;
    p.staysActiveInBackground = false;
  });
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    // Do not pause on the final pigeon frame. Removing IntroScreen releases the
    // player; pausing first leaves that frame visible while React changes screens.
    onDone();
  }, [player, onDone]);

  useEffect(() => {
    const end = player.addListener('playToEnd', finish);
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      // Hand off just before the encoded final frame. Some Android players emit
      // playToEnd a frame late, which otherwise looks like a frozen pigeon.
      if (currentTime >= 7.05) finish();
    });
    const status = player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') finish();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { finish(); return true; });
    const appState = AppState.addEventListener('change', next => {
      if (finished.current) return;
      try { if (next === 'active') player.play(); else player.pause(); } catch { finish(); }
    });
    // A corrupt asset or stalled player must never block access to the game.
    const timeout = setTimeout(finish, 15000);
    try {
      if (player.status === 'error') finish();
      else if (AppState.currentState === 'active' || AppState.currentState == null) {
        player.timeUpdateEventInterval = 0.1;
        player.play();
      }
    } catch { finish(); }
    return () => {
      clearTimeout(timeout);
      end.remove(); time.remove(); status.remove(); back.remove(); appState.remove();
      // useVideoPlayer owns release; no decoder remains during gameplay.
    };
  }, [player, finish]);

  return (
    <View style={styles.root} testID="launch-intro">
      <VideoView
        testID="launch-video"
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <Pressable
        testID="skip-intro"
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
        onPress={finish}
        hitSlop={12}
        style={[styles.skip, { top: insets.top + 16 }]}
      ><Text style={styles.skipText}>SKIP ›</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090b12' },
  video: StyleSheet.absoluteFillObject,
  skip: { position: 'absolute', right: 20, minWidth: 80, minHeight: 44, borderRadius: 22, backgroundColor: '#272331', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#62596f' },
  skipText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
