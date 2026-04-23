import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  fetchSharingUsers,
  removeFriend,
  sendFriendRequest,
  type Friendship,
  type FriendshipList,
  type SharingUser,
} from '@/lib/api';

function otherUserId(row: Friendship, meId: number): number {
  return row.requester_id === meId ? row.addressee_id : row.requester_id;
}

function otherUsername(row: Friendship, meId: number): string {
  return row.requester_id === meId ? row.addressee_username : row.requester_username;
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const meId = user?.id ?? 0;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sharingUsers, setSharingUsers] = useState<SharingUser[]>([]);
  const [friendships, setFriendships] = useState<FriendshipList>({
    accepted: [],
    pending_incoming: [],
    pending_outgoing: [],
  });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const [users, f] = await Promise.all([fetchSharingUsers(), fetchFriendships()]);
      setSharingUsers(users.filter((u) => u.id !== meId));
      setFriendships(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load friends.');
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();

  const acceptedFriendUserIds = useMemo(
    () =>
      new Set(
        friendships.accepted.map((f) => otherUserId(f, meId)),
      ),
    [friendships.accepted, meId],
  );

  const incomingUserIds = useMemo(
    () =>
      new Set(
        friendships.pending_incoming.map((f) => otherUserId(f, meId)),
      ),
    [friendships.pending_incoming, meId],
  );

  const outgoingUserIds = useMemo(
    () =>
      new Set(
        friendships.pending_outgoing.map((f) => otherUserId(f, meId)),
      ),
    [friendships.pending_outgoing, meId],
  );

  const friendCandidates = useMemo(
    () =>
      sharingUsers.filter(
        (u) =>
          !acceptedFriendUserIds.has(u.id) &&
          !incomingUserIds.has(u.id) &&
          !outgoingUserIds.has(u.id) &&
          (q === '' || u.username.toLowerCase().includes(q)),
      ),
    [acceptedFriendUserIds, incomingUserIds, outgoingUserIds, q, sharingUsers],
  );

  const filteredIncoming = useMemo(
    () =>
      friendships.pending_incoming.filter((f) =>
        q === '' ? true : f.requester_username.toLowerCase().includes(q),
      ),
    [friendships.pending_incoming, q],
  );

  const filteredOutgoing = useMemo(
    () =>
      friendships.pending_outgoing.filter((f) =>
        q === '' ? true : f.addressee_username.toLowerCase().includes(q),
      ),
    [friendships.pending_outgoing, q],
  );

  const filteredAccepted = useMemo(
    () =>
      friendships.accepted.filter((f) =>
        q === '' ? true : otherUsername(f, meId).toLowerCase().includes(q),
      ),
    [friendships.accepted, meId, q],
  );

  async function onSend(userId: number) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await sendFriendRequest(userId);
      await load();
      setMessage('Request sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send request.');
    } finally {
      setBusy(false);
    }
  }

  async function onAccept(friendshipId: number) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await acceptFriendRequest(friendshipId);
      await load();
      setMessage('Friend request accepted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept request.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveOrCancel(otherUserId: number) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await removeFriend(otherUserId);
      await load();
      setMessage('Updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 28),
        paddingHorizontal: 20,
      }}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Friends</Text>
      <Text style={styles.subtitle}>Search people on this Ray server, manage requests, and your list.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Search</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Username"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {loading ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 18 }} /> : null}
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!loading && filteredIncoming.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requests</Text>
          {filteredIncoming.map((f) => (
            <View key={f.id} style={styles.row}>
              <Text style={styles.rowName}>{f.requester_username}</Text>
              <Pressable disabled={busy} onPress={() => void onAccept(f.id)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Accept</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && filteredOutgoing.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending</Text>
          {filteredOutgoing.map((f) => (
            <View key={f.id} style={styles.row}>
              <Text style={styles.rowName}>{f.addressee_username}</Text>
              <Pressable
                disabled={busy}
                onPress={() => void onRemoveOrCancel(f.addressee_id)}
                style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your friends</Text>
        {filteredAccepted.length === 0 ? (
          <Text style={styles.muted}>No matches.</Text>
        ) : (
          filteredAccepted.map((f) => {
            const oid = otherUserId(f, meId);
            const name = otherUsername(f, meId);
            return (
              <View key={f.id} style={styles.row}>
                <Text style={styles.rowName}>{name}</Text>
                <Pressable disabled={busy} onPress={() => void onRemoveOrCancel(oid)} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Remove</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add friend</Text>
        {q === '' ? (
          <Text style={styles.muted}>Type a username to search, or browse everyone below.</Text>
        ) : null}
        {friendCandidates.length === 0 ? (
          <Text style={styles.muted}>{q ? 'No users match that search.' : 'No users available to add.'}</Text>
        ) : (
          friendCandidates.map((u) => (
            <View key={u.id} style={styles.row}>
              <Text style={styles.rowName}>{u.username}</Text>
              <Pressable disabled={busy} onPress={() => void onSend(u.id)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Request</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  backRow: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textSecondary },
  title: { fontFamily: fonts.serifSemi, fontSize: 26, color: theme.textPrimary, marginBottom: 6 },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  field: { gap: 6, marginBottom: 16 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 14,
    backgroundColor: theme.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.textPrimary,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
  },
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: 12,
  },
  bannerText: { fontFamily: fonts.sansRegular, color: theme.error, fontSize: 15 },
  message: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textSecondary, marginBottom: 12 },
  section: { gap: 10, marginBottom: 22 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.textMuted, textTransform: 'uppercase' },
  row: {
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
  rowName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textPrimary },
  muted: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textMuted },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: theme.bgSecondary,
  },
  secondaryBtnText: { fontFamily: fonts.sansSemiBold, color: theme.textPrimary, fontSize: 15 },
});
