import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fonts, theme } from '@/constants/theme';
import { mediaUrl, type MomentPhoto } from '@/lib/api';
import { MEMORY_DISK_CACHE_POLICY } from '@/lib/imageCache';
import { cachedImageAspect, imageCacheKey, rememberImageAspect } from '@/lib/imageSource';

type Props = {
  photos: MomentPhoto[];
  onOpen: () => void;
};

/** All pages load thumbnails into the same cache used by the detail screen. */
export function MomentPhotoCarousel({ photos, onOpen }: Props) {
  const ordered = [...photos].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  if (!ordered.length) return null;
  return <PhotoPages key={ordered.map((photo) => photo.id).join(',')} photos={ordered} onOpen={onOpen} />;
}

function PhotoPages({ photos, onOpen }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const firstUri = mediaUrl(photos[0].thumbnail || photos[0].image);
  const [aspect, setAspect] = useState(() => cachedImageAspect(firstUri) ?? 1);
  const pageRef = useRef(0);

  // Preserve the selected page when the available width changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: pageRef.current * width, animated: false });
  }, [width]);

  function goToPage(next: number) {
    const index = Math.max(0, Math.min(photos.length - 1, next));
    pageRef.current = index;
    setPage(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  }

  return (
    <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)} style={styles.root}>
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          directionalLockEnabled
          nestedScrollEnabled
          removeClippedSubviews={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={{ height: width / aspect }}
          onScroll={({ nativeEvent }) => {
            const index = Math.max(0, Math.min(photos.length - 1,
              Math.round(nativeEvent.contentOffset.x / width)));
            pageRef.current = index;
            setPage(index);
          }}>
          {photos.map((photo, index) => {
            const uri = mediaUrl(photo.thumbnail || photo.image);
            return (
              <Pressable
                key={photo.id}
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={'Open moment, photo ' + (index + 1) + ' of ' + photos.length + (photo.caption ? ': ' + photo.caption : '')}
                accessibilityHint="Swipe left or right to browse photos"
                accessibilityElementsHidden={index !== page}
                importantForAccessibility={index === page ? 'auto' : 'no-hide-descendants'}
                style={{ width, height: width / aspect }}>
                <Image
                  source={{ uri, cacheKey: imageCacheKey(uri) }}
                  cachePolicy={MEMORY_DISK_CACHE_POLICY}
                  contentFit="contain"
                  transition={0}
                  style={StyleSheet.absoluteFill}
                  onLoad={({ source }) => {
                    rememberImageAspect(uri, source.width, source.height);
                    if (index === 0) setAspect(cachedImageAspect(uri) ?? 1);
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {width > 0 ? (
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            disabled={page === 0}
            accessibilityState={{ disabled: page === 0 }}
            onPress={() => goToPage(page - 1)}
            style={[styles.arrow, page === 0 && styles.disabled]}>
            <Ionicons name="chevron-back" size={18} color={theme.cardBg} />
          </Pressable>
          <Text style={styles.counter} accessibilityLabel={'Photo ' + (page + 1) + ' of ' + photos.length}>
            {page + 1} / {photos.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            disabled={page === photos.length - 1}
            accessibilityState={{ disabled: page === photos.length - 1 }}
            onPress={() => goToPage(page + 1)}
            style={[styles.arrow, page === photos.length - 1 && styles.disabled]}>
            <Ionicons name="chevron-forward" size={18} color={theme.cardBg} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: theme.bgSecondary },
  controls: {
    position: 'absolute', right: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, backgroundColor: 'rgba(20, 22, 28, 0.7)',
  },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  counter: { color: theme.cardBg, fontFamily: fonts.sansSemiBold, fontSize: 12 },
});
