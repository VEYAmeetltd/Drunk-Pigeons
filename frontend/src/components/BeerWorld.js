import React, { useEffect, useState } from 'react';
import { View, Platform, UIManager, requireNativeComponent, StyleSheet } from 'react-native';
import { sceneBlurRadius, prepareBeerRenderer } from '../game/beerRenderer';

const canBlur = Platform.OS === 'android' && Number(Platform.Version) >= 31;
const hasNativeView = Platform.OS === 'android' && !!UIManager.getViewManagerConfig('DPBeerWorld');
const Scene = hasNativeView ? requireNativeComponent('DPBeerWorld') : View;

export default function BeerWorld({ boosted, drunkLevel = 0, onPrepared, children }) {
  const [warming, setWarming] = useState(canBlur && hasNativeView);
  useEffect(() => {
    if (!canBlur || !hasNativeView) {
      onPrepared();
      return undefined;
    }
    return prepareBeerRenderer(
      requestAnimationFrame,
      cancelAnimationFrame,
      () => setWarming(false),
      onPrepared,
    );
  }, [onPrepared]);

  if (canBlur && !hasNativeView && !(typeof __DEV__ !== 'undefined' && __DEV__)) {
    throw new Error('DP native beer effect is missing. Run expo prebuild before building this APK.');
  }
  const nativeProps = hasNativeView
    ? { beerBlurRadius: canBlur ? sceneBlurRadius(drunkLevel, warming || boosted) : 0 }
    : {};
  return (
    <Scene {...nativeProps} style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false} testID="beer-world">
      {children}
    </Scene>
  );
}
