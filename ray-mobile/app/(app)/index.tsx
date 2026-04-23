import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AspectFitImage } from '@/components/AspectFitImage';
import { useAuth } from '@/contexts/AuthContext';
import { fonts, theme } from '@/constants/theme';
import { formatSmartDate } from '@/lib/formatSmartDate';
import { getSunriseSunset } from '@/lib/sunTimes';
import {
  LIST_BIBLE_VERSE_MAX_WORDS,
  LIST_REFLECTION_MAX_WORDS,
  truncateWords,
} from '@/lib/truncateWords';
import {
  acceptFriendRequest,
  fetchFriendships,
  fetchMoments,
  fetchProfile,
  mediaUrl,
  type Friendship,
  type Moment,
  type Profile,
} from '@/lib/api';

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind;
}

type FeedTab = 'all' | 'friends' | 'mentions';

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
  const [todaySunTimes, setTodaySunTimes] = useState<{ sunrise: string; sunset: string } | null>(null);
  const [sunLineFallback, setSunLineFallback] = useState('Finding sunrise and sunset…');
  const [feedTab, setFeedTab] = useState<FeedTab>('all');
  const [friendUserIds, setFriendUserIds] = useState<Set<number>>(new Set());
  const [pendingIncoming, setPendingIncoming] = useState<Friendship[]>([]);
  const [friendRequestBusyId, setFriendRequestBusyId] = useState<number | null>(null);
  const [friendRequestError, setFriendRequestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setFriendRequestError(null);
    try {
      const [list, friendships] = await Promise.all([fetchMoments(), fetchFriendships()]);
      setMoments(list);
      setPendingIncoming(friendships.pending_incoming ?? []);
      const accepted = new Set<number>();
      for (const row of friendships.accepted) {
        accepted.add(row.requester_id === user?.id ? row.addressee_id : row.requester_id);
      }
      setFriendUserIds(accepted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load moments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const onAcceptFriendRequest = useCallback(
    async (friendshipId: number) => {
      setFriendRequestError(null);
      setFriendRequestBusyId(friendshipId);
      try {
        await acceptFriendRequest(friendshipId);
        await load();
      } catch (e) {
        setFriendRequestError(e instanceof Error ? e.message : 'Could not accept request.');
      } finally {
        setFriendRequestBusyId(null);
      }
    },
    [load],
  );

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted' || cancelled) {
          if (!cancelled) setSunLineFallback('Enable location to show today’s sunrise and sunset.');
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const times = getSunriseSunset(
          new Date(),
          position.coords.latitude,
          position.coords.longitude,
        );
        if (!times || cancelled) return;
        const tf = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
        setTodaySunTimes({
          sunrise: tf.format(times.sunrise),
          sunset: tf.format(times.sunset),
        });
      } catch {
        if (!cancelled) setSunLineFallback('Could not load sunrise and sunset right now.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const visibleMoments = useMemo(() => {
    if (feedTab === 'friends') return moments.filter((m) => friendUserIds.has(m.author));
    if (feedTab === 'mentions') {
      return moments.filter((m) =>
        m.tagged_people.some(
          (p) =>
            (user?.id != null && p.linked_user === user.id) ||
            (profile?.person_id != null && p.id === profile.person_id),
        ),
      );
    }
    return moments;
  }, [feedTab, friendUserIds, moments, profile?.person_id, user?.id]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 92, 112) },
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
        <View style={styles.sunInline}>
        {todaySunTimes ? (
          <>
            <View style={styles.sunInlineItem}>
              <Ionicons name="sunny" size={16} color={theme.accentDusk} />
              <Text style={styles.sunInlineText}>{todaySunTimes.sunrise}</Text>
            </View>
            <View style={styles.sunInlineItem}>
              <Ionicons name="sunny-outline" size={16} color={theme.accentDusk} />
              <Text style={styles.sunInlineText}>{todaySunTimes.sunset}</Text>
            </View>
          </>
        ) : (
          <View style={styles.sunInlineItem}>
            <Ionicons name="location-outline" size={15} color={theme.accentDusk} />
            <Text style={styles.sunInlineText}>{sunLineFallback}</Text>
          </View>
        )}
        </View>

      {pendingIncoming.length > 0 ? (
        <View style={styles.friendReqCard}>
          <View style={styles.friendReqHead}>
            <Text style={styles.friendReqTitle}>Friend requests</Text>
            <Pressable onPress={() => router.push('/friends')} hitSlop={8}>
              <Text style={styles.friendReqManage}>Manage</Text>
            </Pressable>
          </View>
          {pendingIncoming.slice(0, 3).map((row) => {
            const avatarUri = mediaUrl(row.requester_avatar);
            const busy = friendRequestBusyId === row.id;
            return (
              <View key={row.id} style={styles.friendReqRow}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.friendReqAvatar} />
                ) : (
                  <View style={styles.friendReqAvatarFallback}>
                    <Text style={styles.friendReqAvatarLetter}>
                      {row.requester_username.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.friendReqName} numberOfLines={1}>
                  {row.requester_username}
                </Text>
                <Pressable
                  onPress={() => void onAcceptFriendRequest(row.id)}
                  disabled={busy || friendRequestBusyId != null}
                  style={({ pressed }) => [
                    styles.friendReqAccept,
                    (busy || friendRequestBusyId != null) && styles.friendReqAcceptDisabled,
                    pressed && !busy && friendRequestBusyId == null && { opacity: 0.92 },
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={theme.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.friendReqAcceptText}>Accept</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
          {pendingIncoming.length > 3 ? (
            <Pressable onPress={() => router.push('/friends')} style={styles.friendReqMore}>
              <Text style={styles.friendReqMoreText}>
                +{pendingIncoming.length - 3} more — open Friends
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {friendRequestError ? (
        <View style={styles.friendReqErr} accessibilityRole="alert">
          <Text style={styles.friendReqErrText}>{friendRequestError}</Text>
        </View>
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

      {!loading && !error && visibleMoments.length === 0 ? (
        <Text style={styles.muted}>
          {feedTab === 'friends'
            ? 'No friend moments yet.'
            : feedTab === 'mentions'
              ? 'No moments mention you yet.'
              : 'No moments yet — create one to get started.'}
        </Text>
      ) : null}

      <View style={styles.list}>
        {visibleMoments.map((m) => {
          const photos = m.photos ?? [];
          const thumb = photos.length
            ? [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
            : null;
          const commentCount = m.comments_count ?? 0;
          const reactionCount = m.reactions_count ?? 0;
          const posterName = m.author_username ?? `user_${m.author}`;
          const posterAvatarUri = m.author_avatar ? mediaUrl(m.author_avatar) : '';
          return (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/moment/${m.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.98 }]}>
              <View style={styles.cardPoster}>
                {posterAvatarUri ? (
                  <Image source={{ uri: posterAvatarUri }} style={styles.cardPosterAvatar} />
                ) : (
                  <View style={styles.cardPosterAvatarFallback}>
                    <Text style={styles.cardPosterAvatarLetter}>
                      {posterName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.cardPosterName} numberOfLines={1}>
                  {posterName}
                </Text>
              </View>
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
                <View style={styles.cardSocial} accessibilityLabel={`${commentCount} comments, ${reactionCount} reactions`}>
                  <Ionicons name="chatbubble-outline" size={15} color={theme.textMuted} />
                  <Text style={styles.cardSocialText}>{commentCount}</Text>
                  <Ionicons
                    name="heart-outline"
                    size={15}
                    color={theme.textMuted}
                    style={styles.cardSocialIconSecond}
                  />
                  <Text style={styles.cardSocialText}>{reactionCount}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      </ScrollView>
      <View style={[styles.feedTabs, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={() => setFeedTab('all')}
          accessibilityRole="tab"
          accessibilityLabel="All moments"
          accessibilityState={{ selected: feedTab === 'all' }}
          style={[styles.feedTabBtn, feedTab === 'all' && styles.feedTabBtnOn]}>
          <Ionicons
            name="albums-outline"
            size={18}
            color={feedTab === 'all' ? theme.textPrimary : theme.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => setFeedTab('friends')}
          accessibilityRole="tab"
          accessibilityLabel="Friends moments"
          accessibilityState={{ selected: feedTab === 'friends' }}
          style={[styles.feedTabBtn, feedTab === 'friends' && styles.feedTabBtnOn]}>
          <View style={styles.feedTabInner}>
            <Ionicons
              name="people-outline"
              size={18}
              color={feedTab === 'friends' ? theme.textPrimary : theme.textSecondary}
            />
            {pendingIncoming.length > 0 ? (
              <View style={styles.feedTabBadge} accessibilityLabel={`${pendingIncoming.length} pending friend requests`}>
                <Text style={styles.feedTabBadgeText}>
                  {pendingIncoming.length > 9 ? '9+' : String(pendingIncoming.length)}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          onPress={() => setFeedTab('mentions')}
          accessibilityRole="tab"
          accessibilityLabel="Mentioned moments"
          accessibilityState={{ selected: feedTab === 'mentions' }}
          style={[styles.feedTabBtn, feedTab === 'mentions' && styles.feedTabBtnOn]}>
          <Ionicons
            name="at-outline"
            size={18}
            color={feedTab === 'mentions' ? theme.textPrimary : theme.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const timelineCardShadow = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' },
  default: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  content: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
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
  sunInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sunInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sunInlineText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.accentDusk,
  },
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
    ...timelineCardShadow,
  },
  cardPoster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(47, 47, 47, 0.1)',
  },
  cardPosterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bgSecondary,
  },
  cardPosterAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPosterAvatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  cardPosterName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
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
  cardSocial: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardSocialIconSecond: { marginLeft: 6 },
  cardSocialText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.textMuted,
  },
  feedTabs: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  feedTabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgSecondary,
  },
  feedTabBtnOn: { backgroundColor: theme.pillBg },
  feedTabInner: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  feedTabBadge: {
    position: 'absolute',
    top: -8,
    right: -14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: theme.accentDusk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedTabBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: '#fff',
  },
  feedTabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.textSecondary,
  },
  feedTabTextOn: { color: theme.textPrimary },
  friendReqCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 10,
  },
  friendReqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  friendReqTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  friendReqManage: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: theme.accentDusk,
  },
  friendReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  friendReqAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bgSecondary,
  },
  friendReqAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendReqAvatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  friendReqName: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: theme.textPrimary,
  },
  friendReqAccept: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.pillBg,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendReqAcceptDisabled: { opacity: 0.55 },
  friendReqAcceptText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.textPrimary,
  },
  friendReqMore: { paddingVertical: 2 },
  friendReqMoreText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: theme.textMuted,
  },
  friendReqErr: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
  },
  friendReqErrText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.textSecondary,
  },
});
