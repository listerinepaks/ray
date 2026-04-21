import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AspectFitImage } from '@/components/AspectFitImage';
import { RayLogo } from '@/components/RayLogo';
import { fonts, theme } from '@/constants/theme';
import { formatSmartDate } from '@/lib/formatSmartDate';
import { fetchMoment, mediaUrl, MomentNotFoundError, type Moment } from '@/lib/api';

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind;
}

function formatObserved(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return null;
  }
}

export default function MomentEntryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = useMemo(() => {
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [raw]);

  const [moment, setMoment] = useState<Moment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const displayTitle =
    moment.title.trim() ||
    `${formatKindLabel(moment.kind)} · ${formatSmartDate(moment.date)}`;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) }}>
      <View style={styles.pad}>
        <Pressable onPress={() => router.push('/')} accessibilityRole="link">
          <RayLogo />
        </Pressable>

        <View style={styles.nav}>
          <Pressable onPress={() => router.push('/')} hitSlop={12}>
            <Text style={styles.back}>← All moments</Text>
          </Pressable>
          <View style={styles.navRight}>
            {moment.my_access === 'edit' ? (
              <Pressable onPress={() => router.push(`/moment/edit/${moment.id}`)} hitSlop={8}>
                <Text style={styles.navAction}>Edit moment</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/moment/new')} hitSlop={8}>
              <Text style={styles.navAction}>+ New moment</Text>
            </Pressable>
            {moment.my_access ? (
              <View style={styles.accessPill}>
                <Text style={styles.accessPillText}>{moment.my_access}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {hero ? (
          <View style={styles.hero}>
            <AspectFitImage
              uri={mediaUrl(hero.image)}
              accessibilityLabel={hero.caption || displayTitle}
            />
            {hero.caption ? <Text style={styles.heroCaption}>{hero.caption}</Text> : null}
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={styles.meta}>
            <Text style={styles.metaKind}>{formatKindLabel(moment.kind)}</Text>
            <Text style={styles.metaSep}> · </Text>
            <Text>{formatSmartDate(moment.date)}</Text>
            {formatObserved(moment.observed_at) ? (
              <>
                <Text style={styles.metaSep}> · </Text>
                <Text>{formatObserved(moment.observed_at)}</Text>
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
                <View key={p.id} style={styles.chip}>
                  <Text style={styles.chipText}>{p.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
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
  nav: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  back: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textSecondary },
  navRight: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', maxWidth: '58%' },
  navAction: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.textSecondary },
  accessPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.pillBg,
  },
  accessPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: theme.pillFg,
    textTransform: 'lowercase',
  },
  hero: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.bgSecondary,
    marginBottom: 20,
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
});
