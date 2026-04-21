import { Image } from 'react-native';

/** visual/ray.png — landscape wordmark (765×372) */
const ASPECT = 765 / 372;
const BASE_H = 32;

const wordmark = require('@/assets/ray.png');

type Props = {
  /** Scale factor (1 ≈ default header wordmark) */
  scale?: number;
};

export function RayLogo({ scale = 1 }: Props) {
  const h = BASE_H * scale;
  const w = h * ASPECT;
  return (
    <Image
      source={wordmark}
      accessibilityLabel="Ray"
      accessibilityRole="image"
      resizeMode="contain"
      style={{ width: w, height: h }}
    />
  );
}
