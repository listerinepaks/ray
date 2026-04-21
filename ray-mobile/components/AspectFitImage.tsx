import { useEffect, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { theme } from '@/constants/theme';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

/**
 * Sizes the view to the image’s natural aspect ratio (no cropping). Portrait images
 * become taller; landscape stays wide — matches “vertical can be longer.”
 */
export function AspectFitImage({ uri, style, accessibilityLabel }: Props) {
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled || w <= 0 || h <= 0) return;
        setAspect(w / h);
      },
      () => {
        /* keep null → fallback below */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (aspect == null) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={accessibilityLabel}
        resizeMode="contain"
        style={[
          {
            width: '100%',
            aspectRatio: 1,
            backgroundColor: theme.bgSecondary,
          },
          style,
        ]}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={accessibilityLabel}
      resizeMode="cover"
      style={[
        {
          width: '100%',
          aspectRatio: aspect,
          backgroundColor: theme.bgSecondary,
        },
        style,
      ]}
    />
  );
}
