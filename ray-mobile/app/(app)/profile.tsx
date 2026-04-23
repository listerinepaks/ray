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
import {
  acceptFriendRequest,
  fetchFriendships,
  fetchPeople,
  fetchProfile,
  fetchSharingUsers,
  mediaUrl,
  removeFriend,
  sendFriendRequest,
  updateProfile,
  type FriendshipList,
  type Person,
  type PhotoUpload,
  type Profile,
  type SharingUser,
} from '@/lib/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [sharingUsers, setSharingUsers] = useState<SharingUser[]>([]);
  const [friendships, setFriendships] = useState<FriendshipList>({
    accepted: [],
    pending_incoming: [],
    pending_outgoing: [],
  });
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
        const [data, sharedPeople, users, friendshipsData] = await Promise.all([
          fetchProfile(),
          fetchPeople(),
          fetchSharingUsers(),
          fetchFriendships(),
        ]);
        if (cancelled) return;
        setProfile(data);
        setPeople(sharedPeople);
        setSharingUsers(users.filter((x) => x.id !== user?.id));
        setFriendships(friendshipsData);
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

  async function reloadSocial() {
    const [users, friendshipsData] = await Promise.all([fetchSharingUsers(), fetchFriendships()]);
    setSharingUsers(users.filter((x) => x.id !== user?.id));
    setFriendships(friendshipsData);
  }

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
      await reloadSocial();
      setSaveMessage('Person claimed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim this person.');
    } finally {
      setSaving(false);
    }
  }

  const claimablePeople = people.filter((p) => p.linked_user == null);
  const myUserId = user?.id ?? null;
  const acceptedFriendUserIds = new Set(
    friendships.accepted.map((f) => (f.requester_id === myUserId ? f.addressee_id : f.requester_id)),
  );
  const incomingUserIds = new Set(
    friendships.pending_incoming.map((f) => (f.requester_id === myUserId ? f.addressee_id : f.requester_id)),
  );
  const outgoingUserIds = new Set(
    friendships.pending_outgoing.map((f) => (f.requester_id === myUserId ? f.addressee_id : f.requester_id)),
  );
  const friendCandidates = sharingUsers.filter(
    (u) =>
      !acceptedFriendUserIds.has(u.id) && !incomingUserIds.has(u.id) && !outgoingUserIds.has(u.id),
  );

  async function onSendFriendRequest(userId: number) {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await sendFriendRequest(userId);
      await reloadSocial();
      setSaveMessage('Friend request sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send friend request.');
    } finally {
      setSaving(false);
    }
  }

  async function onAcceptFriendRequest(friendshipId: number) {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await acceptFriendRequest(friendshipId);
      await reloadSocial();
      setSaveMessage('Friend request accepted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept friend request.');
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveFriend(otherUserId: number) {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await removeFriend(otherUserId);
      await reloadSocial();
      setSaveMessage('Friend removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove friend.');
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

          {profile.person_id != null ? (
            <View style={styles.claimCard}>
              <Text style={styles.claimTitle}>Friends</Text>
              {friendships.pending_incoming.length > 0 ? (
                <View style={styles.friendSection}>
                  <Text style={styles.label}>Requests</Text>
                  {friendships.pending_incoming.map((f) => (
                    <View key={f.id} style={styles.friendRow}>
                      <Text style={styles.friendName}>{f.requester_username}</Text>
                      <Pressable
                        disabled={saving}
                        onPress={() => void onAcceptFriendRequest(f.id)}
                        style={styles.secondaryBtn}>
                        <Text style={styles.secondaryBtnText}>Accept</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.friendSection}>
                <Text style={styles.label}>Your friends</Text>
                {friendships.accepted.length === 0 ? (
                  <Text style={styles.saved}>No friends yet.</Text>
                ) : (
                  friendships.accepted.map((f) => {
                    const isRequester = f.requester_id === myUserId;
                    const otherName = isRequester ? f.addressee_username : f.requester_username;
                    const otherId = isRequester ? f.addressee_id : f.requester_id;
                    return (
                      <View key={f.id} style={styles.friendRow}>
                        <Text style={styles.friendName}>{otherName}</Text>
                        <Pressable
                          disabled={saving}
                          onPress={() => void onRemoveFriend(otherId)}
                          style={styles.secondaryBtn}>
                          <Text style={styles.secondaryBtnText}>Remove</Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
              <View style={styles.friendSection}>
                <Text style={styles.label}>Add friend</Text>
                {friendCandidates.length === 0 ? (
                  <Text style={styles.saved}>No additional users available to add right now.</Text>
                ) : (
                  friendCandidates.map((u) => (
                    <View key={u.id} style={styles.friendRow}>
                      <Text style={styles.friendName}>{u.username}</Text>
                      <Pressable
                        disabled={saving}
                        onPress={() => void onSendFriendRequest(u.id)}
                        style={styles.secondaryBtn}>
                        <Text style={styles.secondaryBtnText}>Request</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : null}

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
  friendSection: { gap: 8 },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.cardBg,
  },
  friendName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textPrimary },
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
