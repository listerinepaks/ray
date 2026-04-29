import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, theme } from '@/constants/theme';
import { fetchNotifications, markAllNotificationsRead, mediaUrl, type NotificationItem } from '@/lib/api';

function notificationCopy(item: NotificationItem): string {
  const actor = item.actor_username ?? 'Someone';
  if (item.type === 'friend_posted') return `${actor} shared a new moment.`;
  if (item.type === 'friend_request_received') return `${actor} sent you a friend request.`;
  if (item.type === 'friend_request_accepted') return `${actor} accepted your friend request.`;
  if (item.type === 'moment_commented') return `${actor} commented on your moment.`;
  if (item.type === 'moment_reacted') return `${actor} reacted to your moment.`;
  if (item.type === 'mentioned') return `${actor} mentioned you.`;
  return `${actor} sent you a notification.`;
}

function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  if (hr < 48) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onMarkAllRead = useCallback(async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark as read.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: Math.max(insets.bottom + 24, 34),
      }}>
      <View style={styles.head}>
        <Text style={styles.title}>Notifications</Text>
        <Pressable disabled={busy} onPress={() => void onMarkAllRead()} style={styles.markBtn}>
          <Text style={styles.markBtnText}>{busy ? 'Marking…' : 'Mark all read'}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 24 }} /> : null}
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <Text style={styles.muted}>No notifications yet.</Text>
      ) : null}

      <View style={styles.list}>
        {items.map((item) => {
          const avatar = mediaUrl(item.actor_avatar);
          const actor = item.actor_username ?? `user_${item.actor}`;
          return (
            <Pressable
              key={item.id}
              style={[styles.row, !item.read_at && styles.rowUnread]}
              onPress={() => {
                if (item.moment) router.push(`/moment/${item.moment}`);
              }}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{actor.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.rowMain}>
                <Text style={styles.rowText}>{notificationCopy(item)}</Text>
                <Text style={styles.rowDate}>{formatNotificationTime(item.created_at)}</Text>
              </View>
              {!item.read_at ? <Ionicons name="ellipse" size={10} color={theme.accentPeach} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 },
  title: { fontFamily: fonts.serifSemi, fontSize: 26, color: theme.textPrimary },
  markBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: theme.bgSecondary },
  markBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: theme.textPrimary },
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: 12,
  },
  bannerText: { fontFamily: fonts.sansRegular, color: theme.error, fontSize: 15 },
  muted: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textMuted, marginTop: 4 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: theme.cardBg,
  },
  rowUnread: {
    borderColor: theme.accentPeach,
    backgroundColor: theme.bgSecondary,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowText: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textPrimary },
  rowDate: { marginTop: 2, fontFamily: fonts.sansRegular, fontSize: 12, color: theme.textMuted },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.bgSecondary },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  avatarLetter: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.textPrimary },
});
