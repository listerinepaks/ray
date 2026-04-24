import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  MemoryShareArtifact,
  type MemoryShareFormat,
  type MemoryShareOverlay,
} from '@/components/MemoryShareArtifact';
import { fonts, theme } from '@/constants/theme';
import {
  fetchMoment,
  mediaUrl,
  MomentNotFoundError,
  type Moment,
} from '@/lib/api';

function parseYmdLocal(ymd: string): Date {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN);
  const [y, mo, d] = parts;
  return new Date(y!, mo! - 1, d!);
}

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind;
}

function formatObservedShort(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return null;
  }
}

/** Quiet line for the artifact — not “loud metadata.” */
function formatSoftWhenLine(moment: Moment): string {
  const t = parseYmdLocal(moment.date);
  if (Number.isNaN(t.getTime())) return '';
  const dayPart = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(t);
  const kind = formatKindLabel(moment.kind);
  const time = formatObservedShort(moment.observed_at);
  if (time) return `${dayPart} · ${kind.toLowerCase()} · ${time}`;
  return `${dayPart} · ${kind.toLowerCase()}`;
}

export default function MemoryShareScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = useMemo(() => {
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [raw]);

  const [moment, setMoment] = useState<Moment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [format, setFormat] = useState<MemoryShareFormat>('square');
  const [overlay, setOverlay] = useState<MemoryShareOverlay>('light');
  const [showDate, setShowDate] = useState(true);
  const [showCaption, setShowCaption] = useState(true);
  const [showBranding, setShowBranding] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [sharing, setSharing] = useState(false);

  const captureRefView = useRef<View>(null);

  const previewWidth = Math.min(360, Dimensions.get('window').width - 36);

  useEffect(() => {
    if (id == null) {
      setError('Invalid entry.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const m = await fetchMoment(id);
        if (!cancelled) {
          setMoment(m);
          const refTrim = m.reflection?.trim() ?? '';
          setCaptionDraft(refTrim);
          setShowCaption(refTrim.length > 0);
        }
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

  const imageUri = useMemo(() => {
    if (!moment?.photos?.length) return null;
    const sorted = [...moment.photos].sort((a, b) => a.sort_order - b.sort_order);
    const first = sorted[0];
    return first ? mediaUrl(first.image) : null;
  }, [moment]);

  const whenLine = moment ? formatSoftWhenLine(moment) : '';

  const onShare = useCallback(async () => {
    if (!moment || Platform.OS === 'web') {
      Alert.alert('Not available', 'Sharing an image works in the iOS and Android apps.');
      return;
    }
    const node = captureRefView.current;
    if (!node) return;
    setSharing(true);
    try {
      const outW = format === 'square' ? 1080 : 1080;
      const outH = format === 'square' ? 1080 : 1920;
      const uri = await captureRef(node, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: outW,
        height: outH,
      });
      const can = await Sharing.isAvailableAsync();
      if (!can) {
        Alert.alert('Could not share', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Take this with you',
      });
    } catch (e) {
      Alert.alert('Could not create image', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSharing(false);
    }
  }, [format, moment]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Loading…</Text>
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
        <Text style={styles.bannerText}>{error ?? 'Something went wrong.'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (moment.my_access !== 'edit') {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.centeredPage,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.bannerText}>Only you can create a share image for this moment.</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 28),
          paddingHorizontal: 18,
          paddingTop: 8,
        }}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>A single image to save or send — only what you choose appears on it.</Text>

      <View
        ref={captureRefView}
        collapsable={false}
        style={styles.previewCard}
        accessibilityLabel="Share preview">
        <MemoryShareArtifact
          width={previewWidth}
          imageUri={imageUri}
          format={format}
          overlay={overlay}
          showDate={showDate}
          showCaption={showCaption}
          captionText={captionDraft}
          subtleWhenLine={whenLine}
          showBranding={showBranding}
        />
      </View>

      <View style={styles.toggleBlock}>
        <RowToggle
          label="Date & time"
          hint="Small line at the bottom when on."
          value={showDate}
          onValueChange={setShowDate}
        />
        <RowToggle
          label="Words on the image"
          hint="Uses the text below when on."
          value={showCaption}
          onValueChange={setShowCaption}
        />
        <RowChoice
          label="Shape"
          a="Square"
          b="Story"
          isA={format === 'square'}
          onPickA={() => setFormat('square')}
          onPickB={() => setFormat('story')}
        />
        <RowChoice
          label="Overlay"
          a="Light"
          b="Dark"
          isA={overlay === 'light'}
          onPickA={() => setOverlay('light')}
          onPickB={() => setOverlay('dark')}
        />
        <RowToggle
          label="Tiny “Ray” credit"
          hint="Off by default."
          value={showBranding}
          onValueChange={setShowBranding}
        />
      </View>

      {showCaption ? (
        <View style={styles.captionBlock}>
          <Text style={styles.captionLabel}>Words (from your journal if you wrote there)</Text>
          <TextInput
            value={captionDraft}
            onChangeText={setCaptionDraft}
            placeholder="What did this moment mean?"
            placeholderTextColor={theme.textMuted}
            multiline
            style={styles.captionInput}
            textAlignVertical="top"
          />
        </View>
      ) : null}

        <Pressable
          onPress={() => void onShare()}
          disabled={sharing || Platform.OS === 'web'}
          style={({ pressed }) => [
            styles.shareBtn,
            (sharing || Platform.OS === 'web') && styles.shareBtnDisabled,
            pressed && !sharing && Platform.OS !== 'web' && { opacity: 0.92 },
          ]}>
          {sharing ? (
            <ActivityIndicator color={theme.textPrimary} size="small" />
          ) : (
            <Text style={styles.shareBtnText}>
              {Platform.OS === 'web' ? 'Use the app to share' : 'Save or share image…'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RowToggle({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.cardBorder, true: 'rgba(167, 183, 201, 0.55)' }}
        thumbColor={theme.cardBg}
        ios_backgroundColor={theme.cardBorder}
        accessibilityLabel={label}
      />
    </View>
  );
}

function RowChoice({
  label,
  a,
  b,
  isA,
  onPickA,
  onPickB,
}: {
  label: string;
  a: string;
  b: string;
  isA: boolean;
  onPickA: () => void;
  onPickB: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.choicePair}>
        <Pressable
          onPress={onPickA}
          style={[styles.choiceChip, isA && styles.choiceChipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: isA }}>
          <Text style={[styles.choiceChipText, isA && styles.choiceChipTextOn]}>{a}</Text>
        </Pressable>
        <Pressable
          onPress={onPickB}
          style={[styles.choiceChip, !isA && styles.choiceChipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: !isA }}>
          <Text style={[styles.choiceChipText, !isA && styles.choiceChipTextOn]}>{b}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredPage: { paddingHorizontal: 20 },
  muted: { fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textMuted },
  bannerText: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: theme.textPrimary,
    marginBottom: 16,
  },
  backLink: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: theme.textSecondary,
  },
  lede: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.textSecondary,
    marginBottom: 18,
  },
  previewCard: {
    alignSelf: 'center',
    marginBottom: 22,
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.bgSecondary,
  },
  toggleBlock: {
    gap: 4,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(47, 47, 47, 0.08)',
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: theme.textPrimary,
  },
  rowHint: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  choicePair: { flexDirection: 'row', gap: 8 },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
  },
  choiceChipOn: {
    borderColor: 'rgba(167, 183, 201, 0.65)',
    backgroundColor: 'rgba(167, 183, 201, 0.22)',
  },
  choiceChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: theme.textSecondary,
  },
  choiceChipTextOn: {
    color: theme.textPrimary,
  },
  captionBlock: { marginBottom: 20 },
  captionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 8,
  },
  captionInput: {
    minHeight: 100,
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
  shareBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.accentGolden,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDisabled: { opacity: 0.55 },
  shareBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: theme.textPrimary,
  },
});
