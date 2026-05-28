import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { type StyleProp } from 'react-native';

import { theme } from '@/constants/theme';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

/**
 * Sizes the view to the image's natural aspect ratio (no cropping). Portrait images
 * become taller; landscape stays wide — matches "vertical can be longer."
 */
export function AspectFitImage({ uri, style, accessibilityLabel }: Props) {
  const [aspect, setAspect] = useState<number | null>(null);

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={accessibilityLabel}
      contentFit={aspect == null ? 'contain' : 'cover'}
      transition={150}
      style={[
        {
          width: '100%',
          aspectRatio: aspect ?? 1,
          backgroundColor: theme.bgSecondary,
        },
        style,
      ]}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) setAspect(width / height);
      }}
    />
  );
}
