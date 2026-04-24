import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchMoments,
  fetchProfile,
  mediaUrl,
  type Moment,
  type Profile,
} from '@/lib/api';

const SPACE_SM = 12;
const SPACE_MD = 16;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setError(null);
    try {
      const [data, allMoments] = await Promise.all([fetchProfile(), fetchMoments()]);
      setProfile(data);
      setMoments(allMoments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadProfile();
  }, [loadProfile, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const avatarUri = useMemo(() => mediaUrl(profile?.avatar), [profile?.avatar]);
  const authoredMoments = useMemo(() => {
    if (!profile) return [];
    return moments
      .filter((m) => m.author === user?.id)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [moments, profile, user?.id]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: SPACE_MD,
        paddingBottom: Math.max(insets.bottom, 28),
        paddingHorizontal: 20,
      }}>
      {loading ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: SPACE_MD }} /> : null}
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

        {profile ? (
          <>
            <View style={styles.publicPreviewCard}>
              <View style={styles.publicPreviewHead}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.publicPreviewAvatar} />
                ) : (
                  <View style={[styles.publicPreviewAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.publicPreviewAvatarLetter}>
                      {(profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.publicPreviewCopy}>
                  <Text style={styles.publicPreviewName}>
                    {profile.display_name.trim() || profile.username}
                  </Text>
                  <Text style={styles.publicPreviewUsername}>@{profile.username}</Text>
                </View>
              </View>
              <Text style={styles.publicPreviewBio}>{profile.bio.trim() || 'No bio added yet.'}</Text>
              <View style={styles.memoryMeta}>
                <Text style={styles.memoryMetaLine}>
                  <Text style={styles.memoryMetaCount}>{profile.moments_authored}</Text> memories you've
                  captured
                </Text>
                <Text style={styles.memoryMetaLine}>
                  <Text style={styles.memoryMetaCount}>{profile.moments_shared_with_me}</Text> memories
                  shared with you
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable onPress={() => router.push('/friends')} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Friends</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/profile-edit')} style={[styles.actionBtn, styles.actionBtnPrimary]}>
                <Text style={styles.actionBtnText}>Edit profile</Text>
              </Pressable>
            </View>

            <View style={styles.momentsSection}>
              {authoredMoments.length === 0 ? (
                <View style={styles.emptyMomentsCard}>
                  <Text style={styles.emptyMomentsTitle}>No moments yet</Text>
                  <Text style={styles.emptyMomentsBody}>
                    Start your story with your first moment.
                  </Text>
                  <Pressable
                    onPress={() => router.push('/moment/new')}
                    style={({ pressed }) => [styles.emptyMomentsBtn, pressed && { opacity: 0.92 }]}>
                    <Text style={styles.emptyMomentsBtnText}>Create moment</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.momentsGrid}>
                  {authoredMoments.map((m) => {
                    const sorted = [...(m.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                    const first = sorted[0];
                    const thumb = first ? mediaUrl(first.image) : '';
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => router.push(`/moment/${m.id}`)}
                        style={styles.momentTile}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.momentTileImage} />
                        ) : (
                          <View style={[styles.momentTileImage, styles.momentTileFallback]}>
                            <Text style={styles.momentTileFallbackText}>No photo</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

          </>
        ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  hero: {
    flexDirection: 'row',
    gap: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.bgSecondary,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 28,
    color: theme.textSecondary,
  },
  heroCopy: { flex: 1, gap: 6 },
  kicker: {
    fontFamily: fonts.sansSemiBold,
    color: theme.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 28,
    color: theme.textPrimary,
  },
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: SPACE_MD,
  },
  bannerText: { fontFamily: fonts.sansRegular, color: theme.error, fontSize: 15 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACE_MD,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: theme.pillBg,
    borderColor: 'rgba(167, 183, 201, 0.65)',
  },
  actionBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: theme.textPrimary,
  },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textSecondary },
  publicPreviewCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.08)',
    backgroundColor: '#fffdf9',
    marginBottom: SPACE_MD,
  },
  publicPreviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  publicPreviewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.cardBg,
  },
  publicPreviewAvatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 24,
    color: theme.textSecondary,
  },
  publicPreviewCopy: { flex: 1, minWidth: 0, gap: 1 },
  publicPreviewName: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: theme.textPrimary },
  publicPreviewUsername: { fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textMuted },
  publicPreviewBio: { fontFamily: fonts.serifItalic, fontSize: 16, color: theme.textSecondary, lineHeight: 24 },
  momentsSection: { gap: SPACE_SM },
  momentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  momentTile: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: theme.bgPrimary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  momentTileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.bgSecondary,
  },
  momentTileFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  momentTileFallbackText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
  },
  emptyMomentsCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
    gap: 8,
  },
  emptyMomentsTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: theme.textPrimary,
  },
  emptyMomentsBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  emptyMomentsBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.accentGolden,
  },
  emptyMomentsBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: theme.textPrimary,
  },
  memoryMeta: {
    marginTop: 2,
    gap: 4,
  },
  memoryMetaLine: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  memoryMetaCount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  saved: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textSecondary },
});
