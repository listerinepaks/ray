import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AspectFitImage } from '@/components/AspectFitImage';
import { RayLogo } from '@/components/RayLogo';
import { useAuth } from '@/contexts/AuthContext';
import { fonts, theme } from '@/constants/theme';
import { formatSmartDate } from '@/lib/formatSmartDate';
import {
  LIST_BIBLE_VERSE_MAX_WORDS,
  LIST_REFLECTION_MAX_WORDS,
  truncateWords,
} from '@/lib/truncateWords';
import { fetchMoments, fetchProfile, mediaUrl, type Moment, type Profile } from '@/lib/api';

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind;
}

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchMoments();
      setMoments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load moments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchProfile();
        if (!cancelled) setProfile(next);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useLayoutEffect(() => {
    const avatarUri = mediaUrl(profile?.avatar);
    const avatarLabel = profile?.display_name || user?.username || '?';
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => router.push('/profile')}
          hitSlop={12}
          style={styles.headerAvatarButton}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.headerAvatarImage} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarLetter}>
                {avatarLabel.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => router.push('/moment/new')}
          hitSlop={12}
          style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
          <Text style={styles.headerNew}>New moment</Text>
        </Pressable>
      ),
    });
  }, [navigation, profile?.avatar, profile?.display_name, router, user?.username]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 24) },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={theme.textSecondary}
        />
      }>
      <View style={styles.hero}>
        <RayLogo scale={1.15} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroText}>Add a sunrise or sunset when you’re ready.</Text>
          <Pressable
            onPress={() => router.push('/moment/new')}
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.92 }]}>
            <Text style={styles.heroCtaText}>Write a moment</Text>
          </Pressable>
        </View>
      </View>

      {user ? (
        <Text style={styles.signedIn}>
          Signed in as <Text style={styles.signedInName}>{user.username}</Text>
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 16 }} />
      ) : null}
      {error ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerStrong}>Could not load moments.</Text>
          <Text style={styles.bannerBody}> {error}</Text>
        </View>
      ) : null}

      {!loading && !error && moments.length === 0 ? (
        <Text style={styles.muted}>No moments yet — create one to get started.</Text>
      ) : null}

      <View style={styles.list}>
        {moments.map((m) => {
          const photos = m.photos ?? [];
          const thumb = photos.length
            ? [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
            : null;
          return (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/moment/${m.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.98 }]}>
              {thumb ? (
                <View style={styles.thumbWrap}>
                  <AspectFitImage uri={mediaUrl(thumb.image)} />
                  {photos.length > 1 ? (
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>{photos.length} photos</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.placeholder} />
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardHead}>
                  <Text style={styles.kind}>{formatKindLabel(m.kind)}</Text>
                  <Text style={styles.date}>{formatSmartDate(m.date)}</Text>
                  {m.my_access ? (
                    <View style={styles.accessPill}>
                      <Text style={styles.accessPillText}>{m.my_access}</Text>
                    </View>
                  ) : null}
                </View>
                {m.title ? (
                  <Text style={styles.cardTitle}>{m.title}</Text>
                ) : (
                  <Text style={styles.cardTitle}>
                    {formatKindLabel(m.kind)} · {formatSmartDate(m.date)}
                  </Text>
                )}
                {m.bible_verse ? (
                  <Text style={styles.bible}>
                    {truncateWords(m.bible_verse, LIST_BIBLE_VERSE_MAX_WORDS)}
                  </Text>
                ) : null}
                {m.location_name ? (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={17}
                      color={theme.textMuted}
                      style={styles.locationIcon}
                    />
                    <Text style={styles.location} numberOfLines={1}>
                      {m.location_name}
                    </Text>
                  </View>
                ) : null}
                {m.reflection ? (
                  <Text style={styles.reflection}>
                    {truncateWords(m.reflection, LIST_REFLECTION_MAX_WORDS)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  content: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerAvatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    marginLeft: 4,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerAvatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  headerNew: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 201, 93, 0.35)',
    backgroundColor: 'rgba(243, 239, 231, 0.95)',
  },
  heroCopy: { flex: 1, minWidth: 200, gap: 12 },
  heroText: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  heroCta: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.accentGolden,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  heroCtaText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  signedIn: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  signedInName: { color: theme.textPrimary, fontFamily: fonts.sansSemiBold },
  muted: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: theme.textMuted,
    marginBottom: 16,
  },
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: 16,
  },
  bannerStrong: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  bannerBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: theme.textSecondary,
  },
  list: { gap: 18, paddingBottom: 8 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  /** Full width; height comes from image aspect ratio (portrait = taller). */
  thumbWrap: {
    width: '100%',
    backgroundColor: theme.bgSecondary,
  },
  photoBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 22, 28, 0.55)',
  },
  photoBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.3,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#dcd3c8',
  },
  cardBody: { paddingHorizontal: 14, paddingVertical: 14 },
  cardHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
  },
  kind: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.textPrimary,
    textTransform: 'capitalize',
  },
  date: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: theme.textMuted,
  },
  accessPill: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.pillBg,
  },
  accessPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: theme.pillFg,
    textTransform: 'lowercase',
  },
  cardTitle: {
    marginTop: 8,
    fontFamily: fonts.serifSemi,
    fontSize: 19,
    color: theme.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  bible: {
    marginTop: 8,
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  locationRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  locationIcon: { marginTop: 2 },
  location: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: theme.textSecondary,
  },
  reflection: {
    marginTop: 10,
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.textPrimary,
  },
});
