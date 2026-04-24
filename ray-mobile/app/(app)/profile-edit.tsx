import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useHeaderHeight } from '@react-navigation/elements';

import { fonts, theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchPeople,
  fetchProfile,
  mediaUrl,
  updateProfile,
  type Person,
  type PhotoUpload,
  type Profile,
} from '@/lib/api';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarDraft, setAvatarDraft] = useState<PhotoUpload | null>(null);
  const [claimPersonId, setClaimPersonId] = useState<number | null>(null);
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
        const [data, sharedPeople] = await Promise.all([fetchProfile(), fetchPeople()]);
        if (cancelled) return;
        setProfile(data);
        setPeople(sharedPeople);
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
  }, [user?.id]);

  const avatarUri = useMemo(
    () => avatarDraft?.uri ?? mediaUrl(profile?.avatar),
    [avatarDraft?.uri, profile?.avatar],
  );
  const claimablePeople = people.filter((p) => p.linked_user == null);

  async function chooseAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Photo library permission is required to choose an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function claimPerson() {
    if (claimPersonId == null) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const next = await updateProfile({ person_id: claimPersonId });
      setProfile(next);
      setDisplayName(next.display_name);
      setBio(next.bio);
      setClaimPersonId(null);
      setSaveMessage('Person claimed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim this person.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 28),
          paddingHorizontal: 20,
        }}>
        {loading ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 18 }} /> : null}
        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}
        {profile ? (
          <View style={styles.card}>
            {profile.person_id == null ? (
              <View style={styles.claimCard}>
                <Text style={styles.claimTitle}>Claim an existing person</Text>
                <Text style={styles.claimBody}>
                  If someone already added you, claim that shared person entry instead of creating a
                  duplicate.
                </Text>
                {claimablePeople.map((person) => {
                  const selected = claimPersonId === person.id;
                  return (
                    <Pressable
                      key={person.id}
                      onPress={() => setClaimPersonId(person.id)}
                      style={[styles.claimOption, selected && styles.claimOptionSelected]}>
                      <Text style={[styles.claimOptionText, selected && styles.claimOptionTextSelected]}>
                        {person.name}
                      </Text>
                    </Pressable>
                  );
                })}
                {claimablePeople.length === 0 ? (
                  <Text style={styles.saved}>No unclaimed shared people are available right now.</Text>
                ) : (
                  <Pressable
                    onPress={() => void claimPerson()}
                    disabled={claimPersonId == null || saving}
                    style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>Claim person</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            <View style={styles.previewRow}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.previewAvatar} />
              ) : (
                <View style={[styles.previewAvatar, styles.previewAvatarFallback]}>
                  <Text style={styles.previewAvatarLetter}>
                    {(displayName || profile.username || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Pressable onPress={() => void chooseAvatar()} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Choose avatar</Text>
              </Pressable>
            </View>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
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
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.08)',
  },
  claimCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
  },
  claimTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  claimBody: { fontFamily: fonts.sansRegular, fontSize: 14, lineHeight: 20, color: theme.textSecondary },
  claimOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
  },
  claimOptionSelected: {
    borderColor: theme.accentGolden,
    backgroundColor: 'rgba(244, 201, 93, 0.14)',
  },
  claimOptionText: { fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textPrimary },
  claimOptionTextSelected: { fontFamily: fonts.sansSemiBold },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.bgSecondary },
  previewAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  previewAvatarLetter: { fontFamily: fonts.sansSemiBold, fontSize: 24, color: theme.textSecondary },
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
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  secondaryBtnText: { fontFamily: fonts.sansSemiBold, color: theme.textPrimary, fontSize: 15 },
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
    alignSelf: 'stretch',
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.error,
    textAlign: 'center',
  },
});
