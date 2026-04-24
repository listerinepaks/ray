import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts, theme } from '@/constants/theme';

export type MemoryShareFormat = 'square' | 'story';
export type MemoryShareOverlay = 'light' | 'dark';

type Props = {
  /** Layout width; height follows format (square 1:1, story 9:16). */
  width: number;
  imageUri: string | null;
  format: MemoryShareFormat;
  overlay: MemoryShareOverlay;
  showDate: boolean;
  showCaption: boolean;
  captionText: string;
  subtleWhenLine: string;
  showBranding: boolean;
};

function scale(base: number, w: number) {
  return Math.round(base * (w / 360));
}

export function MemoryShareArtifact({
  width,
  imageUri,
  format,
  overlay,
  showDate,
  showCaption,
  captionText,
  subtleWhenLine,
  showBranding,
}: Props) {
  const height = format === 'square' ? width : Math.round((width * 16) / 9);
  const padH = scale(22, width);
  const padBottom = scale(28, width);
  const captionSize = scale(17, width);
  const whenSize = scale(11, width);
  const brandSize = scale(9, width);

  const captionTrim = captionText.trim();
  const hasCaption = showCaption && captionTrim.length > 0;

  const isDark = overlay === 'dark';
  const captionColor = isDark ? 'rgba(250,247,242,0.95)' : 'rgba(47,47,47,0.88)';
  const whenColor = isDark ? 'rgba(250,247,242,0.55)' : 'rgba(47,47,47,0.45)';
  const brandColor = isDark ? 'rgba(250,247,242,0.35)' : 'rgba(47,47,47,0.28)';

  const gradientColors: [string, string, string] = isDark
    ? ['transparent', 'rgba(15,15,18,0.2)', 'rgba(15,15,18,0.62)']
    : ['transparent', 'rgba(250,247,242,0.15)', 'rgba(250,247,242,0.88)'];

  const locations: [number, number, number] = [0.35, 0.72, 1];

  return (
    <View style={[styles.root, { width, height, backgroundColor: theme.bgSecondary }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.emptyPhoto]} />
      )}

      <LinearGradient
        colors={gradientColors}
        locations={locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[styles.textBlock, { paddingHorizontal: padH, paddingBottom: padBottom }]}
        pointerEvents="none">
        {hasCaption ? (
          <Text
            style={[
              styles.caption,
              {
                fontSize: captionSize,
                lineHeight: Math.round(captionSize * 1.45),
                color: captionColor,
              },
            ]}>
            {captionTrim}
          </Text>
        ) : null}
        {showDate && subtleWhenLine ? (
          <Text style={[styles.when, { fontSize: whenSize, color: whenColor, marginTop: hasCaption ? scale(10, width) : 0 }]}>
            {subtleWhenLine}
          </Text>
        ) : null}
      </View>

      {showBranding ? (
        <Text
          style={[
            styles.brand,
            { fontSize: brandSize, color: brandColor, right: padH, bottom: scale(14, width) },
          ]}>
          Ray
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderRadius: 0,
  },
  emptyPhoto: {
    backgroundColor: theme.bgSecondary,
  },
  textBlock: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  caption: {
    fontFamily: fonts.serifItalic,
    letterSpacing: 0.2,
  },
  when: {
    fontFamily: fonts.sansMedium,
    letterSpacing: 0.3,
  },
  brand: {
    position: 'absolute',
    fontFamily: fonts.sansMedium,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
