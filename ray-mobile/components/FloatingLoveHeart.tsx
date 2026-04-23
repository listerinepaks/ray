import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Decorative heart for users in Django auth group `love` (exact name).
 * Sits above bottom safe area / tab chrome; does not intercept touches.
 */
export function FloatingLoveHeart() {
  const insets = useSafeAreaInsets();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom: Math.max(insets.bottom + 72, 88),
          right: Math.max(insets.right + 12, 16),
        },
      ]}
      pointerEvents="none"
      accessible={false}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Ionicons name="heart" size={32} color="#c94b6a" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 9999,
  },
});
