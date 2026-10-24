import { Image, type ImageProps, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp } from 'react-native';

import { theme } from '@/constants/theme';
import { MEMORY_DISK_CACHE_POLICY } from '@/lib/imageCache';
import { cachedImageAspect, imageCacheKey, rememberImageAspect } from '@/lib/imageSource';

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
export function AspectFitImage(props: Props) {
  // Reset only for a different file, not when its signed download URL changes.
  return <AspectFitImageContent key={imageCacheKey(props.uri)} {...props} />;
}

function AspectFitImageContent({
  uri,
  placeholderUri,
  cachePolicy = MEMORY_DISK_CACHE_POLICY,
  style,
  accessibilityLabel,
}: Props) {
  const previewUri = placeholderUri && imageCacheKey(placeholderUri) !== imageCacheKey(uri)
    ? placeholderUri
    : null;
  const [aspect, setAspect] = useState<number | undefined>(() =>
    cachedImageAspect(uri) ?? (previewUri ? cachedImageAspect(previewUri) : undefined),
  );
  const contentFit = aspect == null ? 'contain' : 'cover';

  function recordSize(sourceUri: string, width: number, height: number) {
    rememberImageAspect(sourceUri, width, height);
    // Keep the preview's frame steady while upgrading image quality.
    setAspect((current) => current ?? cachedImageAspect(sourceUri));
  }

  return (
    <View
      style={[
        {
          width: '100%',
          aspectRatio: aspect ?? 1,
          backgroundColor: theme.bgSecondary,
          overflow: 'hidden',
        },
        style,
      ]}>
      {previewUri ? (
        <Image
          source={{ uri: previewUri, cacheKey: imageCacheKey(previewUri) }}
          contentFit={contentFit}
          cachePolicy={cachePolicy}
          transition={0}
          accessible={false}
          style={StyleSheet.absoluteFill}
          onLoad={({ source }) => recordSize(previewUri, source.width, source.height)}
        />
      ) : null}
      <Image
        source={{ uri, cacheKey: imageCacheKey(uri) }}
        accessibilityLabel={accessibilityLabel}
        contentFit={contentFit}
        cachePolicy={cachePolicy}
        transition={previewUri ? 150 : 0}
        style={StyleSheet.absoluteFill}
        onLoad={({ source }) => recordSize(uri, source.width, source.height)}
      />
    </View>
  );
}
