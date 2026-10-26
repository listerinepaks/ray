import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMomentHeart, type Moment } from '@/lib/api';
import { fonts, theme } from '@/constants/theme';
import { canHeartMoment } from '../../ray-shared/momentHeart';

type Props = { moment: Pick<Moment, 'id' | 'my_access' | 'reactions_count'>; userId?: number };

export function MomentHeartButton({ moment, userId }: Props) {
  const [busy, setBusy] = useState(false);
  const [hearted, setHearted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const allowed = userId != null && canHeartMoment(moment.my_access);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function addHeart() {
    if (!allowed || userId == null || pending.current || hearted) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await addMomentHeart(moment.id, userId);
      if (mounted.current) setHearted(true);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not add heart. Try again.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View>
      <Pressable onPress={() => { void addHeart(); }} disabled={!allowed || busy || hearted}
        accessibilityRole="button"
        accessibilityLabel={(busy ? 'Adding heart' : hearted ? 'Heart added' : 'Add heart') + ', ' + (moment.reactions_count ?? 0) + ' reactions'}
        accessibilityState={{ disabled: !allowed || busy || hearted, busy }}
        accessibilityHint={!allowed ? 'You have view-only access to this moment' : undefined}
        style={({ pressed }) => [styles.button, !allowed && styles.disabled, (pressed || busy) && styles.pressed]}>
        <Ionicons name={hearted ? 'heart' : 'heart-outline'} size={18} color="#c94b6a" />
        <Text style={styles.count}>{moment.reactions_count ?? 0}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 56, minHeight: 44, paddingHorizontal: 12, borderRadius: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(201, 75, 106, 0.08)' },
  count: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: theme.textMuted },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  error: { color: theme.error, fontSize: 12, maxWidth: 220, marginTop: 4 },
});
