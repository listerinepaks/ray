import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, theme } from '@/constants/theme';
import { fetchPeople, fetchProfileByPerson, mediaUrl, type Profile } from '@/lib/api';

export default function PersonProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = useMemo(() => {
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [raw]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id == null) {
      setError('Invalid person.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let data: Profile;
        try {
          // Primary path: id is person id.
          data = await fetchProfileByPerson(id);
        } catch {
          // Fallback path: id may actually be user id; map user -> person.
          const people = await fetchPeople();
          const person = people.find((p) => p.linked_user === id);
          if (!person) throw new Error('Could not find this profile.');
          data = await fetchProfileByPerson(person.id);
        }
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.muted}>Loading profile…</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error ?? 'Profile unavailable.'}</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const avatarUri = mediaUrl(profile.avatar);
  const initial = (profile.display_name || profile.username || '?').slice(0, 1).toUpperCase();

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.hero}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
        )}
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>Profile</Text>
          <Text style={styles.heroTitle}>{profile.display_name || profile.username || 'Person'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {profile.bio ? (
          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <Text style={styles.body}>{profile.bio}</Text>
          </View>
        ) : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.moments_authored}</Text>
            <Text style={styles.statLabel}>Moments written</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.moments_shared_with_me}</Text>
            <Text style={styles.statLabel}>Moments shared</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.bgPrimary,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgPrimary,
  },
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
  back: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textSecondary },
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
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: theme.bgSecondary },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: fonts.sansSemiBold, fontSize: 28, color: theme.textSecondary },
  heroCopy: { flex: 1, gap: 6 },
  kicker: {
    fontFamily: fonts.sansSemiBold,
    color: theme.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: { fontFamily: fonts.serifSemi, fontSize: 28, color: theme.textPrimary },
  card: {
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  field: { gap: 6 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textSecondary },
  body: { fontFamily: fonts.sansRegular, fontSize: 16, lineHeight: 23, color: theme.textPrimary },
  stats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  stat: {
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    gap: 4,
  },
  statValue: { fontFamily: fonts.sansSemiBold, fontSize: 22, color: theme.textPrimary },
  statLabel: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textSecondary },
});
