import { Image, type ImageProps, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { type StyleProp } from 'react-native';

import { theme } from '@/constants/theme';
import { MEMORY_DISK_CACHE_POLICY } from '@/lib/imageCache';

type Props = {
  uri: string;
  placeholderUri?: string | null;
  cachePolicy?: ImageProps['cachePolicy'];
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

/**
 * Sizes the view to the image's natural aspect ratio (no cropping). Portrait images
 * become taller; landscape stays wide — matches "vertical can be longer."
 */
export function AspectFitImage({
  uri,
  placeholderUri,
  cachePolicy = MEMORY_DISK_CACHE_POLICY,
  style,
  accessibilityLabel,
}: Props) {
  const [aspect, setAspect] = useState<number | null>(null);
  const contentFit = aspect == null ? 'contain' : 'cover';
  const placeholder = placeholderUri && placeholderUri !== uri ? { uri: placeholderUri } : undefined;

  useEffect(() => {
    setAspect(null);
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      contentFit={contentFit}
      placeholderContentFit={contentFit}
      cachePolicy={cachePolicy}
      recyclingKey={uri}
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
