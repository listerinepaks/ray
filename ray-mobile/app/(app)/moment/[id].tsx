import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AspectFitImage } from '@/components/AspectFitImage';
import { useAuth } from '@/contexts/AuthContext';
import { fonts, theme } from '@/constants/theme';
import { formatSmartDate } from '@/lib/formatSmartDate';
import {
  createMomentComment,
  createMomentReaction,
  deleteMomentComment,
  deleteMomentReaction,
  fetchMoment,
  fetchMomentComments,
  fetchMomentReactions,
  mediaUrl,
  MomentNotFoundError,
  postConvertMoment,
  type Moment,
  type MomentComment,
  type MomentReaction,
} from '@/lib/api';

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind;
}

function formatObserved(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      timeStyle: 'short',
    }).format(d);
  } catch {
    return null;
  }
}

function parseYmdLocal(ymd: string): Date {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN);
  const [y, mo, d] = parts;
  return new Date(y!, mo! - 1, d!);
}

function isOnOrBeforeToday(ymd: string): boolean {
  const t = parseYmdLocal(ymd);
  if (Number.isNaN(t.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return t.getTime() <= today.getTime();
}

function formatCalculatedLight(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return null;
  }
}

const REACTION_TYPES = [
  { type: 'heart', icon: 'heart' as const, label: 'Heart' },
  { type: 'glow', icon: 'sparkles' as const, label: 'Glow' },
  { type: 'wow', icon: 'flash' as const, label: 'Wow' },
] as const;
const DOUBLE_TAP_WINDOW_MS = 300;

function formatCommentTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

export default function MomentEntryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = useMemo(() => {
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [raw]);

  const [moment, setMoment] = useState<Moment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<MomentComment[]>([]);
  const [reactions, setReactions] = useState<MomentReaction[]>([]);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [reactionBusy, setReactionBusy] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const lastHeroTapAtRef = useRef(0);
  const heartOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id == null) {
      setError('Invalid entry.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const m = await fetchMoment(id);
        if (!cancelled) setMoment(m);
      } catch (e) {
        if (e instanceof MomentNotFoundError) {
          router.replace('/');
          return;
        }
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not load this entry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const reloadSocial = useCallback(async (momentId: number) => {
    setSocialError(null);
    try {
      const [c, r] = await Promise.all([
        fetchMomentComments(momentId),
        fetchMomentReactions(momentId),
      ]);
      setComments(c);
      setReactions(r);
    } catch (e) {
      setSocialError(e instanceof Error ? e.message : 'Could not load reactions or comments.');
    }
  }, []);

  useEffect(() => {
    if (moment?.id == null) return;
    let cancelled = false;
    void (async () => {
      try {
        setSocialError(null);
        const [c, r] = await Promise.all([
          fetchMomentComments(moment.id),
          fetchMomentReactions(moment.id),
        ]);
        if (!cancelled) {
          setComments(c);
          setReactions(r);
        }
      } catch (e) {
        if (!cancelled)
          setSocialError(e instanceof Error ? e.message : 'Could not load reactions or comments.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moment?.id]);

  const canCommentOrReact =
    moment?.my_access === 'comment' || moment?.my_access === 'edit';

  async function onSubmitComment() {
    if (!moment || !canCommentOrReact) return;
    const text = commentDraft.trim();
    if (!text) return;
    setPostingComment(true);
    setSocialError(null);
    try {
      const row = await createMomentComment(moment.id, text);
      setCommentDraft('');
      setComments((prev) => [...prev, row]);
    } catch (e) {
      setSocialError(e instanceof Error ? e.message : 'Could not post comment.');
    } finally {
      setPostingComment(false);
    }
  }

  async function onToggleReaction(type: string) {
    if (!moment || !currentUser || !canCommentOrReact) return;
    const mine = reactions.find((x) => x.user === currentUser.id && x.type === type);
    setReactionBusy(type);
    setSocialError(null);
    try {
      if (mine) {
        await deleteMomentReaction(moment.id, mine.id);
        setReactions((prev) => prev.filter((x) => x.id !== mine.id));
      } else {
        const row = await createMomentReaction(moment.id, type);
        setReactions((prev) => [...prev, row]);
      }
    } catch (e) {
      setSocialError(e instanceof Error ? e.message : 'Could not update reaction.');
      await reloadSocial(moment.id);
    } finally {
      setReactionBusy(null);
    }
  }

  function onHeroDoubleTapLike() {
    if (!canCommentOrReact || reactionBusy) return;
    const now = Date.now();
    if (now - lastHeroTapAtRef.current <= DOUBLE_TAP_WINDOW_MS) {
      lastHeroTapAtRef.current = 0;
      if (heartOverlayTimerRef.current) clearTimeout(heartOverlayTimerRef.current);
      setShowHeartOverlay(true);
      heartOverlayTimerRef.current = setTimeout(() => {
        setShowHeartOverlay(false);
        heartOverlayTimerRef.current = null;
      }, 700);
      void onToggleReaction('heart');
      return;
    }
    lastHeroTapAtRef.current = now;
  }

  useEffect(() => {
    return () => {
      if (heartOverlayTimerRef.current) clearTimeout(heartOverlayTimerRef.current);
    };
  }, []);

  async function onDeleteComment(commentId: number) {
    if (!moment) return;
    setDeletingCommentId(commentId);
    setSocialError(null);
    try {
      await deleteMomentComment(moment.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      setSocialError(e instanceof Error ? e.message : 'Could not delete comment.');
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function onConvertLookingAhead() {
    if (!moment) return;
    Alert.alert(
      'We lived this?',
      'Your note will be kept, and you can add how it felt and any photos on the next screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void (async () => {
              setConvertBusy(true);
              setSocialError(null);
              try {
                await postConvertMoment(moment.id, { reflection: '' });
                router.replace(`/moment/edit/${moment.id}`);
              } catch (e) {
                setSocialError(e instanceof Error ? e.message : 'Could not update this moment.');
              } finally {
                setConvertBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  const openOwnerMenu = useCallback(() => {
    if (!moment || moment.my_access !== 'edit') return;
    Alert.alert('Moment actions', undefined, [
      {
        text: 'Edit moment',
        onPress: () => router.push(`/moment/edit/${moment.id}`),
      },
      {
        text: 'Take this with you',
        onPress: () => router.push(`/moment/share/${moment.id}`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [moment, router]);

  useLayoutEffect(() => {
    if (moment?.my_access === 'edit') {
      navigation.setOptions({
        headerRight: () => (
          <Pressable onPress={openOwnerMenu} hitSlop={12} style={styles.headerMenuBtn}>
            <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} />
          </Pressable>
        ),
      });
      return;
    }
    navigation.setOptions({ headerRight: undefined });
  }, [moment?.my_access, navigation, openOwnerMenu]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Loading entry…</Text>
      </View>
    );
  }

  if (error || !moment) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.centeredPage,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}>
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{error ?? 'Something went wrong.'}</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const sortedPhotos = [...moment.photos].sort((a, b) => a.sort_order - b.sort_order);
  const hero = sortedPhotos[0];
  const rest = sortedPhotos.slice(1);
  const observedTime = formatObserved(moment.observed_at);
  const displayTitle =
    moment.title.trim() ||
    `${formatKindLabel(moment.kind)} · ${formatSmartDate(moment.date)}`;
  const posterName = moment.author_username ?? `user_${moment.author}`;
  const posterAvatarUri = moment.author_avatar ? mediaUrl(moment.author_avatar) : '';
  const profileHref =
    currentUser && moment.author === currentUser.id ? '/profile' : `/profile/${moment.author}`;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) }}
        keyboardShouldPersistTaps="handled">
        <View style={styles.pad}>
        <Pressable
          onPress={() => router.push(profileHref)}
          style={({ pressed }) => [styles.detailPoster, pressed && { opacity: 0.92 }]}>
          {posterAvatarUri ? (
            <Image source={{ uri: posterAvatarUri }} style={styles.detailPosterAvatar} />
          ) : (
            <View style={styles.detailPosterAvatarFallback}>
              <Text style={styles.detailPosterAvatarLetter}>
                {posterName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.detailPosterMain}>
            <View style={styles.detailPosterTopRow}>
              <Text style={styles.detailPosterName} numberOfLines={1}>
                {posterName}
              </Text>
              {moment.moment_type === 'looking_ahead' ? (
                <View style={styles.lookingLabelInline} accessibilityLabel="Looking ahead">
                  <Ionicons name="sparkles-outline" size={11} color={theme.textSecondary} />
                  <Text style={styles.lookingLabelInlineText}>Looking ahead</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        {hero ? (
          <Pressable
            onPress={onHeroDoubleTapLike}
            disabled={!canCommentOrReact || reactionBusy != null}
            style={[
              styles.hero,
              moment.moment_type === 'looking_ahead' && styles.heroLookingAhead,
            ]}>
            <AspectFitImage
              uri={mediaUrl(hero.image)}
              accessibilityLabel={hero.caption || displayTitle}
            />
            {showHeartOverlay ? (
              <View pointerEvents="none" style={styles.heartOverlay}>
                <Ionicons name="heart" size={52} color="#fff" />
              </View>
            ) : null}
            {hero.caption ? <Text style={styles.heroCaption}>{hero.caption}</Text> : null}
          </Pressable>
        ) : null}

        <View
          style={[
            styles.content,
            moment.moment_type === 'looking_ahead' && styles.contentLookingAhead,
          ]}>
          {moment.moment_type === 'looking_ahead' ? (
            <View style={styles.lookingBand} accessibilityRole="summary">
              {moment.countdown_phrase ? (
                <Text style={styles.lookingCountdown}>{moment.countdown_phrase}</Text>
              ) : null}
              {formatCalculatedLight(moment.calculated_light_at) ? (
                <Text style={styles.lookingSun}>
                  ~{formatKindLabel(moment.kind).toLowerCase()}{' '}
                  {formatCalculatedLight(moment.calculated_light_at)}
                </Text>
              ) : null}
              {moment.my_access === 'edit' && isOnOrBeforeToday(moment.date) ? (
                <Pressable
                  onPress={() => void onConvertLookingAhead()}
                  disabled={convertBusy}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.lookingConvertBtn,
                    pressed && !convertBusy && { opacity: 0.9 },
                  ]}>
                  <Text style={styles.lookingConvertBtnText}>
                    {convertBusy ? 'Opening…' : 'We lived this'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.meta}>
            <Text style={styles.metaKind}>{formatKindLabel(moment.kind)}</Text>
            <Text style={styles.metaSep}> · </Text>
            <Text>{formatSmartDate(moment.date)}</Text>
            {observedTime ? (
              <>
                <Text style={styles.metaSep}> · </Text>
                <Text>{observedTime}</Text>
              </>
            ) : null}
          </Text>
          <Text style={styles.title}>{displayTitle}</Text>
          {moment.bible_verse ? (
            <Text style={styles.bible}>{moment.bible_verse}</Text>
          ) : null}
          {moment.location_name ? (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={19}
                color={theme.textMuted}
                style={styles.locationIcon}
              />
              <Text style={styles.location}>{moment.location_name}</Text>
            </View>
          ) : null}
          {moment.reflection ? (
            <Text style={styles.reflection}>{moment.reflection}</Text>
          ) : null}
          {moment.original_looking_ahead_note?.trim() ? (
            <View style={styles.originalSection}>
              <Text style={styles.sectionLabel}>What you were looking forward to</Text>
              <Text style={styles.reflectionOriginal}>{moment.original_looking_ahead_note}</Text>
            </View>
          ) : null}
        </View>

        {rest.length > 0 ? (
          <View style={styles.gallery}>
            {rest.map((ph) => (
              <View key={ph.id} style={styles.galleryItem}>
                <AspectFitImage uri={mediaUrl(ph.image)} />
                {ph.caption ? <Text style={styles.galleryCap}>{ph.caption}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {moment.tagged_people?.length ? (
          <View style={styles.people}>
            <Text style={styles.sectionLabel}>People</Text>
            <View style={styles.chips}>
              {moment.tagged_people.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.chip}
                  onPress={() => router.push(`/profile/${p.id}`)}
                >
                  <Text style={styles.chipText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {moment.my_access ? (
          <View style={styles.social}>
            {socialError ? (
              <Text style={styles.socialError} accessibilityRole="alert">
                {socialError}
              </Text>
            ) : null}
            <View style={styles.reactionRow}>
              {REACTION_TYPES.map(({ type, icon, label }) => {
                const count = reactions.filter((r) => r.type === type).length;
                const mine = currentUser
                  ? reactions.some((r) => r.user === currentUser.id && r.type === type)
                  : false;
                const busy = reactionBusy === type;
                return (
                  <Pressable
                    key={type}
                    disabled={!canCommentOrReact || busy}
                    onPress={() => void onToggleReaction(type)}
                    style={({ pressed }) => [
                      styles.reactionBtn,
                      mine && styles.reactionBtnMine,
                      (!canCommentOrReact || busy) && styles.reactionBtnDisabled,
                      pressed && canCommentOrReact && !busy && { opacity: 0.88 },
                    ]}
                    accessibilityLabel={`${label}${mine ? ', selected' : ''}, ${count}`}>
                    {busy ? (
                      <ActivityIndicator size="small" color={theme.textSecondary} />
                    ) : (
                      <View style={styles.reactionBtnContent}>
                        <Ionicons
                          name={icon}
                          size={18}
                          color={mine ? theme.accentDusk : theme.textSecondary}
                        />
                        <Text style={[styles.reactionCount, mine && styles.reactionCountMine]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {!canCommentOrReact ? (
              <Text style={styles.socialHint}>View-only: you can see reactions but not add your own.</Text>
            ) : null}
            {comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet.</Text>
            ) : (
              <View style={styles.commentList}>
                {comments.map((c) => (
                  <View key={c.id} style={styles.commentCard}>
                    <View style={styles.commentHead}>
                      <Text style={styles.commentAuthor}>
                        {c.author_username ?? `User ${c.author}`}
                      </Text>
                      <Text style={styles.commentTime}>{formatCommentTime(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentBody}>{c.text}</Text>
                    {currentUser && c.author === currentUser.id ? (
                      <Pressable
                        onPress={() => void onDeleteComment(c.id)}
                        disabled={deletingCommentId === c.id}
                        hitSlop={8}
                        style={styles.commentDelete}>
                        <Text style={styles.commentDeleteText}>
                          {deletingCommentId === c.id ? 'Removing…' : 'Remove'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {canCommentOrReact ? (
              <View style={styles.commentComposer}>
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="Write a comment…"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  style={styles.commentInput}
                  editable={!postingComment}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={() => void onSubmitComment()}
                  disabled={postingComment || !commentDraft.trim()}
                  style={({ pressed }) => [
                    styles.commentPostBtn,
                    (postingComment || !commentDraft.trim()) && styles.commentPostBtnDisabled,
                    pressed && !postingComment && commentDraft.trim() && { opacity: 0.92 },
                  ]}>
                  {postingComment ? (
                    <ActivityIndicator color={theme.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.commentPostBtnText}>Post</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  pad: { paddingHorizontal: 18, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredPage: { paddingHorizontal: 20 },
  muted: { fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textMuted },
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: 16,
  },
  bannerText: { fontFamily: fonts.sansRegular, fontSize: 15, color: theme.textPrimary },
  backLink: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: theme.textSecondary,
  },
  headerMenuBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  detailPoster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(47, 47, 47, 0.1)',
  },
  detailPosterMain: {
    flex: 1,
    minWidth: 0,
  },
  detailPosterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  detailPosterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bgSecondary,
  },
  detailPosterAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPosterAvatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  detailPosterName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  lookingLabelInline: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(242, 169, 123, 0.42)',
  },
  lookingLabelInlineText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    color: theme.textSecondary,
  },
  hero: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.bgSecondary,
    marginBottom: 20,
  },
  heroLookingAhead: {
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 123, 0.52)',
    backgroundColor: 'rgba(242, 169, 123, 0.12)',
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  heroCaption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.textSecondary,
    backgroundColor: theme.cardBg,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  content: { marginBottom: 8 },
  contentLookingAhead: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 123, 0.52)',
    backgroundColor: 'rgba(242, 169, 123, 0.12)',
    padding: 12,
  },
  lookingBand: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 169, 123, 0.16)',
    gap: 6,
  },
  lookingLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(242, 169, 123, 0.42)',
  },
  lookingLabelText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.textSecondary,
  },
  lookingCountdown: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.accentPeach,
  },
  lookingSun: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: theme.textSecondary,
  },
  lookingConvertBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 169, 123, 0.32)',
  },
  lookingConvertBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.textSecondary,
  },
  meta: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: theme.textMuted,
  },
  metaKind: { color: theme.textSecondary, textTransform: 'capitalize' },
  metaSep: { color: theme.textMuted },
  title: {
    marginTop: 10,
    fontFamily: fonts.serifSemi,
    fontSize: 28,
    lineHeight: 34,
    color: theme.textPrimary,
    letterSpacing: -0.4,
  },
  bible: {
    marginTop: 12,
    fontFamily: fonts.serifItalic,
    fontSize: 17,
    lineHeight: 26,
    color: theme.textSecondary,
  },
  locationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationIcon: { marginTop: 2 },
  location: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: theme.textSecondary,
  },
  reflection: {
    marginTop: 16,
    fontFamily: fonts.sansRegular,
    fontSize: 17,
    lineHeight: 26,
    color: theme.textPrimary,
  },
  originalSection: { marginTop: 22 },
  reflectionOriginal: {
    marginTop: 4,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    lineHeight: 24,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  gallery: { marginTop: 20, gap: 16 },
  galleryItem: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.bgSecondary,
  },
  galleryCap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.textSecondary,
  },
  people: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47, 47, 47, 0.08)',
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 183, 201, 0.28)',
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textPrimary },
  social: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47, 47, 47, 0.08)',
  },
  socialError: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.error,
    marginBottom: 10,
  },
  socialHint: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 8,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  reactionBtn: {
    minWidth: 0,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.12)',
    backgroundColor: 'rgba(47, 47, 47, 0.03)',
    alignItems: 'center',
  },
  reactionBtnMine: {
    borderColor: theme.accentDusk,
    backgroundColor: 'rgba(167, 183, 201, 0.24)',
  },
  reactionBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reactionBtnDisabled: { opacity: 0.55 },
  reactionCount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: theme.textSecondary,
  },
  reactionCountMine: { color: theme.accentDusk },
  noComments: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 8,
    marginBottom: 10,
  },
  commentList: { gap: 10, marginTop: 8, marginBottom: 12 },
  commentCard: {
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
  },
  commentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  commentAuthor: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.textPrimary,
    flex: 1,
  },
  commentTime: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: theme.textMuted,
  },
  commentBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.textPrimary,
  },
  commentDelete: { alignSelf: 'flex-start', marginTop: 6 },
  commentDeleteText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: theme.textSecondary,
  },
  commentComposer: { gap: 10, marginTop: 4 },
  commentInput: {
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.12)',
    backgroundColor: theme.cardBg,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    color: theme.textPrimary,
  },
  commentPostBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.accentGolden,
  },
  commentPostBtnDisabled: { opacity: 0.55 },
  commentPostBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
});
