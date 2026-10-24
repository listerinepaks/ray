import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Modal, Pressable,
  StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clampHeart, heartBounds, heartParticles, heartSize, LOVE_HEART, nextHeartPosition,
} from '../../ray-shared/loveHeart';

type Phase = 'playing' | 'celebrating' | 'cooldown';

/** Mounted only for members of Django's love group. All progress is local. */
export function FloatingLoveHeart() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const initialBounds = heartBounds(width, height, 0, insets);
  const [phase, setPhase] = useState<Phase>('playing');
  const [taps, setTaps] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const tapCount = useRef(0);
  const mounted = useRef(true);
  const target = useRef({ x: initialBounds.maxX, y: initialBounds.maxY });
  const position = useRef(new Animated.ValueXY(target.current)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const centerMove = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const wash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const finale = useRef<Animated.CompositeAnimation | null>(null);
  const heroSize = heartSize(4);
  const heroScale = Math.max(1, Math.min(width * 0.8, height * 0.65) / heroSize);

  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted.current) setReduceMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted.current = false;
      subscription.remove();
      finale.current?.stop();
      position.stopAnimation();
      pulse.stopAnimation();
    };
  }, [position, pulse]);

  useEffect(() => {
    target.current = clampHeart(target.current, heartBounds(width, height, tapCount.current, {
      top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left,
    }));
    position.setValue(target.current);
  }, [width, height, insets.top, insets.right, insets.bottom, insets.left, position]);

  useEffect(() => {
    if (phase !== 'playing' || reduceMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => { animation.stop(); float.setValue(0); };
  }, [phase, reduceMotion, float]);

  useEffect(() => {
    if (phase !== 'cooldown') return;
    const timer = setTimeout(() => {
      tapCount.current = 0;
      const bounds = heartBounds(width, height, 0, insets);
      target.current = { x: bounds.maxX, y: bounds.maxY };
      position.setValue(target.current);
      pulse.setValue(1);
      setTaps(0);
      setPhase('playing');
    }, LOVE_HEART.cooldownMs);
    return () => clearTimeout(timer);
  }, [phase, width, height, insets, position, pulse]);

  function tapHeart() {
    if (tapCount.current >= LOVE_HEART.taps) return;
    const previousSize = heartSize(tapCount.current);
    const next = ++tapCount.current;
    setTaps(next);
    if (next === LOVE_HEART.taps) {
      pulse.stopAnimation();
      position.stopAnimation((point) => {
        if (!mounted.current) return;
        const box = Math.max(44, heroSize + 12);
        centerMove.setValue(reduceMotion ? { x: 0, y: 0 } : {
          x: point.x + box / 2 - width / 2, y: point.y + box / 2 - height / 2,
        });
        scale.setValue(reduceMotion ? heroScale : 1);
        opacity.setValue(1);
        wash.setValue(0);
        burst.setValue(0);
        setPhase('celebrating');
      });
      return;
    }
    target.current = nextHeartPosition(heartBounds(width, height, next, insets), target.current);
    position.stopAnimation();
    if (reduceMotion) {
      position.setValue(target.current);
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    Animated.timing(position, {
      toValue: target.current, duration: LOVE_HEART.hopMs,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    pulse.stopAnimation();
    pulse.setValue(previousSize / heartSize(next));
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.15, duration: 150, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
  }

  function celebrate() {
    if (!mounted.current || phase !== 'celebrating' || finale.current) return;
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, useNativeDriver: true });
    if (reduceMotion) {
      centerMove.setValue({ x: 0, y: 0 });
      scale.setValue(heroScale);
      finale.current = Animated.sequence([
        timing(wash, 1, 120), Animated.delay(200),
        Animated.parallel([timing(opacity, 0, 200), timing(wash, 0, 200)]),
      ]);
    } else {
      finale.current = Animated.sequence([
        Animated.parallel([
          Animated.timing(centerMove, { toValue: { x: 0, y: 0 }, duration: LOVE_HEART.growMs, useNativeDriver: true }),
          timing(scale, heroScale, LOVE_HEART.growMs),
          timing(wash, 1, LOVE_HEART.growMs),
        ]),
        ...[0, 1].flatMap(() => [
          timing(scale, heroScale * 1.12, LOVE_HEART.beatMs / 2),
          timing(scale, heroScale, LOVE_HEART.beatMs / 2),
        ]),
        Animated.parallel([
          timing(opacity, 0, 100),
          timing(scale, heroScale * 1.3, 150),
          timing(burst, 1, LOVE_HEART.burstMs),
          Animated.sequence([Animated.delay(350), timing(wash, 0, LOVE_HEART.burstMs - 350)]),
        ]),
      ]);
    }
    finale.current.start(({ finished }) => {
      finale.current = null;
      if (finished && mounted.current) setPhase('cooldown');
    });
  }

  const size = heartSize(taps);
  const box = Math.max(44, size + 12);
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {phase === 'playing' ? (
        <Animated.View style={[styles.catch, { transform: position.getTranslateTransform() }]}>
          <Pressable
            onPress={tapHeart}
            accessibilityRole="button"
            accessibilityLabel={'Love heart, ' + taps + ' of ' + LOVE_HEART.taps + ' taps'}
            accessibilityHint="Catch the heart five times for a surprise"
            style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ transform: [{ translateY: float }, { scale: pulse }] }}>
              <Ionicons name="heart" size={size} color={LOVE_HEART.color} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}
      <Modal transparent visible={phase === 'celebrating'} animationType="none"
        statusBarTranslucent navigationBarTranslucent onShow={celebrate}
        onRequestClose={() => { finale.current?.stop(); finale.current = null; setPhase('cooldown'); }}>
        <View style={styles.layer} accessibilityLabel="Love everywhere" accessibilityRole="image">
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: LOVE_HEART.backdrop, opacity: wash }]} />
          <Animated.View style={{
            position: 'absolute', left: (width - heroSize) / 2, top: (height - heroSize) / 2,
            opacity, transform: [...centerMove.getTranslateTransform(), { scale }],
          }}>
            <Ionicons name="heart" size={heroSize} color={LOVE_HEART.color} />
          </Animated.View>
          {!reduceMotion ? heartParticles(width, height).map((particle, index) => (
            <Animated.View key={index} style={{
              position: 'absolute', left: (width - particle.size) / 2, top: (height - particle.size) / 2,
              opacity: burst.interpolate({ inputRange: [0, 0.08, 0.65, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] }) },
                { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] }) },
                { scale: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 0.4] }) },
                { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', particle.rotation + 'deg'] }) },
              ],
            }}>
              <Ionicons name="heart" size={particle.size} color={LOVE_HEART.color} />
            </Animated.View>
          )) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 },
  catch: { position: 'absolute', top: 0, left: 0 },
});
