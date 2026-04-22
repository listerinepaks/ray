import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfile, mediaUrl, updateProfile, type PhotoUpload, type Profile } from '@/lib/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarDraft, setAvatarDraft] = useState<PhotoUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProfile();
        if (cancelled) return;
        setProfile(data);
        setDisplayName(data.display_name);
        setBio(data.bio);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avatarUri = useMemo(
    () => avatarDraft?.uri ?? mediaUrl(profile?.avatar),
    [avatarDraft?.uri, profile?.avatar],
  );

  async function chooseAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Photo library permission is required to choose an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.88,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setAvatarDraft({
      uri: asset.uri,
      name: asset.fileName ?? 'profile-photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
    setError(null);
    setSaveMessage(null);
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const next = await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar: avatarDraft ?? undefined,
      });
      setProfile(next);
      setDisplayName(next.display_name);
      setBio(next.bio);
      setAvatarDraft(null);
      setSaveMessage('Profile saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 28),
        paddingHorizontal: 20,
      }}>
      <View style={styles.hero}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>
              {(displayName || profile?.username || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>Your profile</Text>
          <Text style={styles.heroTitle}>{profile?.display_name || profile?.username || 'Profile'}</Text>
          <Text style={styles.heroBody}>
            This is the shared person record linked to your account. Someone can later join and
            claim the same person entry.
          </Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 18 }} /> : null}
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {profile ? (
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={profile.username}
              placeholderTextColor={theme.textMuted}
              maxLength={120}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput value={profile.username} editable={false} style={[styles.input, styles.inputDisabled]} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput value={profile.email} editable={false} style={[styles.input, styles.inputDisabled]} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="A few lines about you."
              placeholderTextColor={theme.textMuted}
              maxLength={280}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />
          </View>

          <Pressable onPress={() => void chooseAvatar()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Choose avatar</Text>
          </Pressable>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.moments_authored}</Text>
              <Text style={styles.statLabel}>Moments written</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.moments_shared_with_me}</Text>
              <Text style={styles.statLabel}>Shared with you</Text>
            </View>
          </View>

          <Pressable onPress={() => void saveProfile()} disabled={saving} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save profile'}</Text>
          </Pressable>
          {saveMessage ? <Text style={styles.saved}>{saveMessage}</Text> : null}

          <Pressable
            onPress={() => void logout().then(() => router.replace('/login'))}
            style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
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
  heroBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.textSecondary,
  },
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: 16,
  },
  bannerText: { fontFamily: fonts.sansRegular, color: theme.error, fontSize: 15 },
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
  input: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 14,
    backgroundColor: theme.bgPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.textPrimary,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
  },
  inputDisabled: { color: theme.textSecondary, backgroundColor: theme.bgSecondary },
  textarea: { minHeight: 110 },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: theme.bgSecondary,
  },
  secondaryBtnText: { fontFamily: fonts.sansSemiBold, color: theme.textPrimary, fontSize: 15 },
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
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: theme.accentGolden,
  },
  primaryBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  saved: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textSecondary },
  signOutBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  signOutText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: theme.error },
});
