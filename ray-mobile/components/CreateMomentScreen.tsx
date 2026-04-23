import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { fonts, theme } from '@/constants/theme';
import {
  createMoment,
  createPerson,
  deleteMoment,
  deleteMomentPhoto,
  fetchMoment,
  fetchPeople,
  fetchSharingUsers,
  mediaUrl,
  patchMomentPhoto,
  updateMoment,
  uploadMomentPhoto,
  type CreateMomentPayload,
  type MomentPhoto,
  type Person,
  type PhotoUpload,
  type SharingUser,
} from '@/lib/api';

const VIS = {
  private: 'private',
  tagged: 'tagged',
  custom: 'custom',
  friends: 'friends',
} as const;

const ACCESS_LEVELS = [
  { value: 'view', label: 'View only' },
  { value: 'comment', label: 'View & comment' },
  { value: 'edit', label: 'Can edit' },
];

type PhotoDraft = {
  key: string;
  uri: string;
  caption: string;
  name: string;
  type: string;
};

type CustomRow = {
  key: string;
  userId: number;
  accessLevel: string;
};

const CREATE_STEPS = ['photos', 'kind', 'story', 'visibility'] as const;
type CreateStep = (typeof CREATE_STEPS)[number];

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateInputFromDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateInput(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseExifDateTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  // Typical EXIF: "YYYY:MM:DD HH:MM:SS"
  const m = value.match(
    /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] ?? '0');
  const parsed = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCapturedAtFromAsset(asset: ImagePicker.ImagePickerAsset): Date | null {
  const exif = asset.exif as Record<string, unknown> | null | undefined;
  const exifCandidates = [
    exif?.DateTimeOriginal,
    exif?.DateTimeDigitized,
    exif?.DateTime,
  ];
  for (const candidate of exifCandidates) {
    const d = parseExifDateTime(candidate);
    if (d) return d;
  }
  if (typeof asset.fileName === 'string') {
    // Handles iOS style IMG_20260422_071512.jpg style names when present.
    const fileNameMatch = asset.fileName.match(
      /(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/,
    );
    if (fileNameMatch) {
      const d = new Date(
        Number(fileNameMatch[1]),
        Number(fileNameMatch[2]) - 1,
        Number(fileNameMatch[3]),
        Number(fileNameMatch[4]),
        Number(fileNameMatch[5]),
        Number(fileNameMatch[6]),
      );
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

type Props = {
  editId?: number | null;
};

export function CreateMomentScreen({ editId: routeEditId }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const editId = routeEditId ?? null;
  const isEdit = editId != null;
  const [createStep, setCreateStep] = useState<CreateStep>('photos');

  const [people, setPeople] = useState<Person[]>([]);
  const [shareUsers, setShareUsers] = useState<SharingUser[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [kind, setKind] = useState<'sunrise' | 'sunset' | 'other'>('sunrise');
  const [date, setDate] = useState(todayDateString);
  const [observedAt, setObservedAt] = useState('');
  const [dateEdited, setDateEdited] = useState(false);
  const [observedAtEdited, setObservedAtEdited] = useState(false);
  const [title, setTitle] = useState('');
  const [bibleVerse, setBibleVerse] = useState('');
  const [reflection, setReflection] = useState('');
  const [locationName, setLocationName] = useState('');
  /** Default `friends`: accepted friends get access (see `sync_moment_access`). `tagged` does not include friends. */
  const [visibility, setVisibility] = useState<string>(VIS.friends);
  const [selectedPeople, setSelectedPeople] = useState<Set<number>>(new Set());
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);

  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<MomentPhoto[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [loadingMoment, setLoadingMoment] = useState(false);
  const [momentLoadError, setMomentLoadError] = useState<string | null>(null);

  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonNote, setNewPersonNote] = useState('');
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);

  const [pickerForRowKey, setPickerForRowKey] = useState<string | null>(null);
  const [whenEditorOpen, setWhenEditorOpen] = useState(false);
  const [whenDraft, setWhenDraft] = useState<Date>(new Date());
  const [whenDraftHasTime, setWhenDraftHasTime] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      try {
        setLoadingRefs(true);
        const [p, u] = await Promise.all([fetchPeople(), fetchSharingUsers()]);
        if (!cancelled) {
          setPeople(p);
          setShareUsers(u.filter((x) => x.id !== currentUser.id));
        }
      } catch {
        if (!cancelled) setSubmitError('Could not load people or users.');
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!isEdit || editId == null) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingMoment(true);
        setMomentLoadError(null);
        const m = await fetchMoment(editId);
        if (cancelled) return;
        if (m.my_access !== 'edit') {
          router.replace(`/moment/${editId}`);
          return;
        }
        setKind(m.kind === 'sunset' ? 'sunset' : m.kind === 'other' ? 'other' : 'sunrise');
        setDate(m.date);
        setObservedAt(m.observed_at ? toDatetimeLocal(m.observed_at) : '');
        setDateEdited(true);
        setObservedAtEdited(true);
        setTitle(m.title);
        setBibleVerse(m.bible_verse ?? '');
        setReflection(m.reflection);
        setLocationName(m.location_name);
        setVisibility(m.visibility_mode);
        setSelectedPeople(new Set(m.tagged_people.map((p) => p.id)));
        const accessList = m.access_list ?? [];
        setCustomRows(
          accessList
            .filter((a) => a.user_id !== m.author)
            .map((a) => ({
              key: newKey(),
              userId: a.user_id,
              accessLevel: a.access_level,
            })),
        );
        setExistingPhotos([...m.photos].sort((a, b) => a.sort_order - b.sort_order));
      } catch (e) {
        if (!cancelled)
          setMomentLoadError(e instanceof Error ? e.message : 'Could not load this moment.');
      } finally {
        if (!cancelled) setLoadingMoment(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId, router]);

  const shareChoices = useMemo(
    () => shareUsers.filter((u) => u.id > 0),
    [shareUsers],
  );

  const addPhotos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setSubmitError('Photo library permission is required to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      exif: true,
      quality: 0.88,
    });
    if (result.canceled) return;
    const next: PhotoDraft[] = [];
    for (const a of result.assets) {
      const uri = a.uri;
      const name = a.fileName ?? `photo-${next.length}.jpg`;
      const type = a.mimeType ?? 'image/jpeg';
      next.push({ key: newKey(), uri, caption: '', name, type });
    }
    setPhotos((prev) => [...prev, ...next]);

    // Preload from first photo metadata if user hasn't already set these.
    const firstWithMetadata = result.assets.map(getCapturedAtFromAsset).find(Boolean) ?? null;
    if (firstWithMetadata) {
      if (!dateEdited) setDate(formatDateInputFromDate(firstWithMetadata));
      if (!observedAtEdited) setObservedAt(toDatetimeLocal(firstWithMetadata.toISOString()));
    }
  }, [dateEdited, observedAtEdited]);

  const removePhoto = useCallback((key: string) => {
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const movePhoto = useCallback((index: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      const t = copy[index]!;
      copy[index] = copy[j]!;
      copy[j] = t;
      return copy;
    });
  }, []);

  const removeExistingPhoto = useCallback(
    async (photoId: number) => {
      if (!isEdit || editId == null) return;
      setSubmitError(null);
      try {
        await deleteMomentPhoto(editId, photoId);
        setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Could not remove photo.');
      }
    },
    [isEdit, editId],
  );

  function togglePerson(id: number) {
    setSelectedPeople((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function addCustomRow() {
    const first = shareChoices[0];
    setCustomRows((rows) => [
      ...rows,
      {
        key: newKey(),
        userId: first?.id ?? 0,
        accessLevel: 'comment',
      },
    ]);
  }

  function setVisibilityMode(next: string) {
    setVisibility(next);
    if (next === VIS.custom && shareChoices.length > 0) {
      setCustomRows((rows) => {
        if (rows.length > 0) return rows;
        return [
          {
            key: newKey(),
            userId: shareChoices[0]!.id,
            accessLevel: 'comment',
          },
        ];
      });
    }
  }

  function updateCustomRow(key: string, patch: Partial<Pick<CustomRow, 'userId' | 'accessLevel'>>) {
    setCustomRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeCustomRow(key: string) {
    setCustomRows((rows) => rows.filter((r) => r.key !== key));
  }

  async function onAddPerson() {
    setPersonError(null);
    if (!newPersonName.trim()) return;
    setPersonSaving(true);
    try {
      const p = await createPerson({
        name: newPersonName.trim(),
        note: newPersonNote.trim() || undefined,
      });
      setPeople((list) => [...list, p].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedPeople((prev) => new Set(prev).add(p.id));
      setNewPersonName('');
      setNewPersonNote('');
      setPersonModalOpen(false);
    } catch (err) {
      setPersonError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setPersonSaving(false);
    }
  }

  function buildPayload(): CreateMomentPayload {
    const payload: CreateMomentPayload = {
      kind,
      date,
      visibility_mode: visibility,
      title: title.trim() || undefined,
      bible_verse: bibleVerse.trim(),
      reflection: reflection.trim() || undefined,
      location_name: locationName.trim() || undefined,
    };
    if (observedAt.trim()) {
      const d = new Date(observedAt);
      if (!Number.isNaN(d.getTime())) payload.observed_at = d.toISOString();
    } else {
      payload.observed_at = null;
    }

    if (visibility === VIS.tagged) {
      payload.people = [...selectedPeople].map((person_id) => ({
        person_id,
        role: 'present',
      }));
    } else {
      payload.people = [];
    }
    if (visibility === VIS.custom) {
      payload.access = customRows
        .filter((r) => r.userId > 0)
        .map((r) => ({
          user_id: r.userId,
          access_level: r.accessLevel,
        }));
    }
    return payload;
  }

  async function onSubmit() {
    setSubmitError(null);

    if (visibility === VIS.tagged && selectedPeople.size === 0) {
      setSubmitError(
        'Choose at least one person to tag, or switch to Friends or Private visibility.',
      );
      return;
    }
    if (visibility === VIS.custom) {
      const valid = customRows.filter((r) => r.userId > 0);
      if (valid.length === 0) {
        setSubmitError('Add at least one person and access level for custom sharing.');
        return;
      }
    }

    setSubmitting(true);
    setUploadPhase(null);
    try {
      const payload = buildPayload();

      if (isEdit && editId != null) {
        await updateMoment(editId, payload);
        for (const ph of existingPhotos) {
          await patchMomentPhoto(editId, ph.id, { caption: ph.caption.trim() });
        }
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i]!;
          setUploadPhase(`Uploading photo ${i + 1} of ${photos.length}…`);
          const file: PhotoUpload = {
            uri: ph.uri,
            name: ph.name,
            type: ph.type,
          };
          await uploadMomentPhoto(editId, file, ph.caption.trim(), existingPhotos.length + i);
        }
        router.replace(`/moment/${editId}`);
      } else {
        const created = await createMoment(payload);
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i]!;
          setUploadPhase(`Uploading photo ${i + 1} of ${photos.length}…`);
          const file: PhotoUpload = {
            uri: ph.uri,
            name: ph.name,
            type: ph.type,
          };
          await uploadMomentPhoto(created.id, file, ph.caption.trim(), i);
        }
        router.replace(`/moment/${created.id}`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
      setUploadPhase(null);
    }
  }

  function onDeleteMoment() {
    if (!isEdit || editId == null || deleting) return;
    Alert.alert(
      'Delete moment?',
      'This will permanently remove this moment and its photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setSubmitError(null);
                setDeleting(true);
                await deleteMoment(editId);
                router.replace('/');
              } catch (err) {
                setSubmitError(err instanceof Error ? err.message : 'Could not delete moment.');
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }

  const stepIndex = CREATE_STEPS.indexOf(createStep);
  const isWizard = !isEdit;

  function goToNextStep() {
    setSubmitError(null);
    if (createStep === 'photos' && photos.length === 0) {
      setSubmitError('Add at least one photo to continue.');
      return;
    }
    const next = CREATE_STEPS[stepIndex + 1];
    if (next) setCreateStep(next);
  }

  function goToPreviousStep() {
    setSubmitError(null);
    const prev = CREATE_STEPS[stepIndex - 1];
    if (prev) setCreateStep(prev);
  }

  function onExitFlow() {
    if (isEdit && editId != null) {
      router.replace(`/moment/${editId}`);
      return;
    }
    router.replace('/');
  }

  function onBackAction() {
    if (isWizard && stepIndex > 0) {
      goToPreviousStep();
      return;
    }
    onExitFlow();
  }

  function openWhenEditor() {
    const observedDate = observedAt ? new Date(observedAt) : null;
    const base =
      observedDate && !Number.isNaN(observedDate.getTime())
        ? observedDate
        : (parseDateInput(date) ?? new Date());
    setWhenDraft(base);
    setWhenDraftHasTime(Boolean(observedAt));
    setWhenEditorOpen(true);
  }

  function onWhenDateChange(_: DateTimePickerEvent, next?: Date) {
    if (next) {
      const d = new Date(whenDraft);
      d.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
      setWhenDraft(d);
    }
  }

  function onWhenTimeChange(_: DateTimePickerEvent, next?: Date) {
    if (next) {
      const d = new Date(whenDraft);
      d.setHours(next.getHours(), next.getMinutes(), 0, 0);
      setWhenDraft(d);
    }
  }

  function saveWhenEditor() {
    setDateEdited(true);
    setObservedAtEdited(true);
    setDate(formatDateInputFromDate(whenDraft));
    if (whenDraftHasTime) {
      setObservedAt(toDatetimeLocal(whenDraft.toISOString()));
    } else {
      setObservedAt('');
    }
    setWhenEditorOpen(false);
  }

  const humanDate = useMemo(() => {
    const base = parseDateInput(date);
    if (!base) return date || 'No date set';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(base);
  }, [date]);

  const humanObservedAt = useMemo(() => {
    if (!observedAt) return null;
    const d = new Date(observedAt);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(d);
  }, [observedAt]);

  if (!currentUser) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bgPrimary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 28) },
        ]}
        keyboardShouldPersistTaps="handled">
        {loadingRefs || (isEdit && loadingMoment) ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : momentLoadError ? (
          <View style={styles.banner} accessibilityRole="alert">
            <Text style={styles.bannerText}>{momentLoadError}</Text>
          </View>
        ) : (
          <>
            <Pressable onPress={onBackAction} style={styles.topBackBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
            </Pressable>

            {submitError ? (
              <View style={styles.banner} accessibilityRole="alert">
                <Text style={styles.bannerText}>{submitError}</Text>
              </View>
            ) : null}
            {uploadPhase ? <Text style={styles.uploadPhase}>{uploadPhase}</Text> : null}

            {isWizard ? (
              <View style={styles.stepHeader}>
                <Text style={styles.stepHeaderText}>
                  Step {stepIndex + 1} of {CREATE_STEPS.length}
                </Text>
                <Text style={styles.stepHeaderTitle}>
                  {createStep === 'photos'
                    ? 'Add photos'
                    : createStep === 'kind'
                      ? 'Choose kind and time'
                      : createStep === 'story'
                        ? 'Add story details'
                        : 'Choose who can see this'}
                </Text>
              </View>
            ) : null}

            {(!isWizard || createStep === 'kind') ? (
              <>
            <Text style={styles.sectionTitle}>Kind & time</Text>
            <View style={styles.kindRow}>
              <Pressable
                onPress={() => setKind('sunrise')}
                style={[
                  styles.kindCard,
                  kind === 'sunrise' && styles.kindCardSelected,
                ]}>
                <Text style={styles.kindEmoji}>☀️</Text>
                <Text style={styles.kindLabel}>Sunrise</Text>
                <Text style={styles.kindHint}>First light</Text>
              </Pressable>
              <Pressable
                onPress={() => setKind('sunset')}
                style={[
                  styles.kindCard,
                  kind === 'sunset' && styles.kindCardSelected,
                ]}>
                <Text style={styles.kindEmoji}>🌙</Text>
                <Text style={styles.kindLabel}>Sunset</Text>
                <Text style={styles.kindHint}>Day closing</Text>
              </Pressable>
              <Pressable
                onPress={() => setKind('other')}
                style={[
                  styles.kindCard,
                  kind === 'other' && styles.kindCardSelected,
                ]}>
                <Text style={styles.kindEmoji}>✨</Text>
                <Text style={styles.kindLabel}>Other</Text>
                <Text style={styles.kindHint}>Any moment</Text>
              </Pressable>
            </View>

            <View style={styles.whenCard}>
              <Text style={styles.whenLabel}>When</Text>
              <Text style={styles.whenValue}>{humanObservedAt ?? humanDate}</Text>
              <Pressable onPress={openWhenEditor} style={styles.whenEditBtn}>
                <Text style={styles.whenEditBtnText}>Edit</Text>
              </Pressable>
            </View>
              </>
            ) : null}

            {(!isWizard || createStep === 'story') ? (
              <>
            <Text style={styles.sectionTitle}>Story</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Optional"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                maxLength={140}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Bible verse</Text>
              <TextInput
                value={bibleVerse}
                onChangeText={setBibleVerse}
                placeholder="Optional — e.g. Psalm 23:1 (ESV)"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                maxLength={300}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Reflection</Text>
              <TextInput
                value={reflection}
                onChangeText={setReflection}
                placeholder="What stayed with you?"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
              />
            </View>
            <View style={styles.field}>
              <View style={styles.labelWithIcon}>
                <Ionicons name="location-outline" size={18} color={theme.textMuted} />
                <Text style={[styles.label, styles.labelInline]}>Place</Text>
              </View>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Where you were"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                maxLength={200}
              />
            </View>
              </>
            ) : null}

            {(!isWizard || createStep === 'visibility') ? (
              <>
            <Text style={styles.sectionTitle}>Who can see this?</Text>
            <View style={styles.visCol}>
              <Pressable
                onPress={() => setVisibilityMode(VIS.private)}
                style={[
                  styles.visCard,
                  visibility === VIS.private && styles.visCardSelected,
                ]}>
                <Text style={styles.visTitle}>Private</Text>
                <Text style={styles.visBody}>Only you. Nothing is shared.</Text>
              </Pressable>
              <Pressable
                onPress={() => setVisibilityMode(VIS.tagged)}
                style={[
                  styles.visCard,
                  visibility === VIS.tagged && styles.visCardSelected,
                ]}>
                <Text style={styles.visTitle}>Tagged people</Text>
                <Text style={styles.visBody}>
                  People you tag can join in. Linked accounts get access automatically.
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setVisibilityMode(VIS.custom)}
                style={[
                  styles.visCard,
                  visibility === VIS.custom && styles.visCardSelected,
                ]}>
                <Text style={styles.visTitle}>Custom</Text>
                <Text style={styles.visBody}>
                  Pick exactly who can view, comment, or edit — by account.
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setVisibilityMode(VIS.friends)}
                style={[
                  styles.visCard,
                  visibility === VIS.friends && styles.visCardSelected,
                ]}>
                <Text style={styles.visTitle}>Friends</Text>
                <Text style={styles.visBody}>
                  Shared with accepted friends. Great for family and close people.
                </Text>
              </Pressable>
            </View>

            {visibility === VIS.tagged ? (
              <View style={styles.block}>
                <View style={styles.peopleHeader}>
                  <Text style={styles.label}>People present</Text>
                  <Pressable onPress={() => setPersonModalOpen(true)} hitSlop={8}>
                    <Text style={styles.link}>+ Add person</Text>
                  </Pressable>
                </View>
                {people.length === 0 ? (
                  <Text style={styles.muted}>No shared people yet. Add someone to tag them on moments.</Text>
                ) : (
                  <View style={styles.chipWrap}>
                    {people.map((p) => {
                      const on = selectedPeople.has(p.id);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => togglePerson(p.id)}
                          style={[styles.chip, on && styles.chipOn]}>
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {visibility === VIS.custom ? (
              <View style={styles.block}>
                <View style={styles.peopleHeader}>
                  <Text style={styles.label}>Share with</Text>
                  <Pressable onPress={addCustomRow} hitSlop={8}>
                    <Text style={styles.link}>+ Add row</Text>
                  </Pressable>
                </View>
                {customRows.map((row) => (
                  <View key={row.key} style={styles.customRow}>
                    <Pressable
                      onPress={() => setPickerForRowKey(row.key)}
                      style={styles.userPick}>
                      <Text style={styles.userPickText}>
                        {shareChoices.find((u) => u.id === row.userId)?.username ??
                          'Choose user'}
                      </Text>
                    </Pressable>
                    <View style={styles.accessPick}>
                      {ACCESS_LEVELS.map((lvl) => (
                        <Pressable
                          key={lvl.value}
                          onPress={() =>
                            updateCustomRow(row.key, { accessLevel: lvl.value })
                          }
                          style={[
                            styles.accessChip,
                            row.accessLevel === lvl.value && styles.accessChipOn,
                          ]}>
                          <Text
                            style={[
                              styles.accessChipText,
                              row.accessLevel === lvl.value && styles.accessChipTextOn,
                            ]}>
                            {lvl.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={() => removeCustomRow(row.key)} hitSlop={8}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
              </>
            ) : null}

            {(!isWizard || createStep === 'photos') ? (
              <>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Pressable onPress={() => void addPhotos()} style={styles.addPhotoBtn}>
              <Text style={styles.addPhotoText}>Add photos</Text>
            </Pressable>

            {existingPhotos.map((ph) => (
              <View key={ph.id} style={styles.photoBlock}>
                <Image
                  source={{ uri: mediaUrl(ph.image) }}
                  style={styles.photoThumb}
                  resizeMode="contain"
                />
                <TextInput
                  value={ph.caption}
                  onChangeText={(t) =>
                    setExistingPhotos((prev) =>
                      prev.map((x) => (x.id === ph.id ? { ...x, caption: t } : x)),
                    )
                  }
                  placeholder="Caption"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
                <Pressable onPress={() => void removeExistingPhoto(ph.id)}>
                  <Text style={styles.remove}>Remove photo</Text>
                </Pressable>
              </View>
            ))}

            {photos.map((ph, idx) => (
              <View key={ph.key} style={styles.photoBlock}>
                <Image
                  source={{ uri: ph.uri }}
                  style={styles.photoThumb}
                  resizeMode="contain"
                />
                <TextInput
                  value={ph.caption}
                  onChangeText={(t) =>
                    setPhotos((prev) =>
                      prev.map((x) => (x.key === ph.key ? { ...x, caption: t } : x)),
                    )
                  }
                  placeholder="Caption"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
                <View style={styles.photoActions}>
                  <Pressable onPress={() => movePhoto(idx, -1)} disabled={idx === 0}>
                    <Text style={styles.move}>Up</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => movePhoto(idx, 1)}
                    disabled={idx === photos.length - 1}>
                    <Text style={styles.move}>Down</Text>
                  </Pressable>
                  <Pressable onPress={() => removePhoto(ph.key)}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
              </>
            ) : null}

            {isWizard ? (
              <View style={styles.stepActions}>
                {createStep !== 'visibility' ? (
                  <Pressable onPress={goToNextStep} style={styles.stepNextBtn}>
                    <Text style={styles.stepNextBtnText}>Next</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void onSubmit()}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.submit,
                      styles.stepSubmitBtn,
                      submitting && styles.submitDisabled,
                      pressed && !submitting && { opacity: 0.94 },
                    ]}>
                    {submitting ? (
                      <ActivityIndicator color={theme.textPrimary} />
                    ) : (
                      <Text style={styles.submitText}>Create moment</Text>
                    )}
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.singleActions}>
                {isEdit ? (
                  <Pressable
                    onPress={onDeleteMoment}
                    disabled={submitting || deleting}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      (submitting || deleting) && styles.submitDisabled,
                      pressed && !(submitting || deleting) && { opacity: 0.92 },
                    ]}>
                    <Text style={styles.deleteBtnText}>{deleting ? 'Deleting…' : 'Delete moment'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => void onSubmit()}
                  disabled={submitting || deleting}
                  style={({ pressed }) => [
                    styles.submit,
                    styles.singleSubmit,
                    (submitting || deleting) && styles.submitDisabled,
                    pressed && !(submitting || deleting) && { opacity: 0.94 },
                  ]}>
                  {submitting ? (
                    <ActivityIndicator color={theme.textPrimary} />
                  ) : (
                    <Text style={styles.submitText}>{isEdit ? 'Save changes' : 'Create moment'}</Text>
                  )}
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={personModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New person</Text>
            <Text style={styles.muted}>They’ll appear in the shared people list for tagging on any moment.</Text>
            <TextInput
              value={newPersonName}
              onChangeText={setNewPersonName}
              placeholder="Name"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
            />
            <TextInput
              value={newPersonNote}
              onChangeText={setNewPersonNote}
              placeholder="Bio or note (optional)"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.textArea]}
              multiline
            />
            {personError ? <Text style={styles.error}>{personError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPersonModalOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onAddPerson()}
                disabled={personSaving}
                style={styles.modalPrimary}>
                {personSaving ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pickerForRowKey != null} animationType="fade" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerForRowKey(null)}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>Choose user</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {shareChoices.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => {
                    if (pickerForRowKey)
                      updateCustomRow(pickerForRowKey, { userId: u.id });
                    setPickerForRowKey(null);
                  }}
                  style={styles.pickerRow}>
                  <Text style={styles.pickerRowText}>{u.username}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPickerForRowKey(null)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={whenEditorOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit date & time</Text>
            <Text style={styles.muted}>Adjust when this moment happened.</Text>
            <View style={styles.whenPickerBlock}>
              <Text style={styles.label}>Date</Text>
              <DateTimePicker
                value={whenDraft}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onWhenDateChange}
              />
            </View>
            <View style={styles.whenToggleRow}>
              <Text style={styles.label}>Include exact time</Text>
              <Pressable
                onPress={() => setWhenDraftHasTime((v) => !v)}
                style={[styles.whenToggleBtn, whenDraftHasTime && styles.whenToggleBtnOn]}>
                <Text style={[styles.whenToggleBtnText, whenDraftHasTime && styles.whenToggleBtnTextOn]}>
                  {whenDraftHasTime ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </View>
            {whenDraftHasTime ? (
              <View style={styles.whenPickerBlock}>
                <Text style={styles.label}>Time</Text>
                <DateTimePicker
                  value={whenDraft}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onWhenTimeChange}
                />
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setWhenEditorOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveWhenEditor} style={styles.modalPrimary}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  muted: { fontFamily: fonts.sansMedium, color: theme.textMuted, marginBottom: 12 },
  banner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.bannerBg,
    borderWidth: 1,
    borderColor: theme.bannerBorder,
    marginBottom: 12,
  },
  bannerText: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textPrimary },
  uploadPhase: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textSecondary, marginBottom: 8 },
  topBackBtn: {
    alignSelf: 'flex-start',
    minWidth: 40,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepHeader: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 4,
  },
  stepHeaderText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: theme.textMuted },
  stepHeaderTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 10,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.textMuted,
  },
  kindRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  kindCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
    padding: 12,
    gap: 4,
  },
  kindCardSelected: {
    borderColor: 'rgba(244, 201, 93, 0.85)',
    backgroundColor: 'rgba(244, 201, 93, 0.12)',
  },
  kindEmoji: { fontSize: 22 },
  kindLabel: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  kindHint: { fontFamily: fonts.sansRegular, fontSize: 13, color: theme.textSecondary },
  row: { flexDirection: 'row', gap: 10 },
  fieldGrow: { flex: 1, marginBottom: 12 },
  field: { marginBottom: 12 },
  whenCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
    padding: 12,
    gap: 8,
  },
  whenLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: theme.textSecondary },
  whenValue: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  whenEditBtn: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    justifyContent: 'center',
    backgroundColor: theme.bgSecondary,
  },
  whenEditBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.textSecondary },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 6,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  labelInline: { marginBottom: 0 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.12)',
    paddingHorizontal: 12,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    color: theme.textPrimary,
    backgroundColor: theme.cardBg,
  },
  textArea: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  visCol: { gap: 10, marginBottom: 14 },
  visCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
    padding: 14,
    gap: 6,
  },
  visCardSelected: {
    borderColor: 'rgba(167, 183, 201, 0.65)',
    backgroundColor: 'rgba(167, 183, 201, 0.12)',
  },
  visTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  visBody: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  block: { marginBottom: 14 },
  peopleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
  },
  chipOn: {
    borderColor: 'rgba(244, 201, 93, 0.65)',
    backgroundColor: 'rgba(244, 201, 93, 0.18)',
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: theme.textPrimary },
  chipTextOn: { fontFamily: fonts.sansSemiBold },
  customRow: {
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBg,
  },
  userPick: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.12)',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  userPickText: { fontFamily: fonts.sansMedium, fontSize: 15, color: theme.textPrimary },
  accessPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accessChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  accessChipOn: { backgroundColor: theme.pillBg, borderColor: 'transparent' },
  accessChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: theme.textSecondary },
  accessChipTextOn: { color: theme.pillFg, fontFamily: fonts.sansSemiBold },
  remove: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.error },
  addPhotoBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  addPhotoText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: theme.textPrimary },
  photoBlock: { marginBottom: 16, gap: 8 },
  photoThumb: { width: '100%', aspectRatio: 1.3, borderRadius: 12, backgroundColor: theme.bgSecondary },
  photoActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  move: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: theme.textSecondary },
  submit: {
    marginTop: 8,
    marginBottom: 24,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: theme.accentGolden,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.65 },
  submitText: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: theme.textPrimary },
  stepActions: {
    marginTop: 8,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  stepNextBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: theme.accentGolden,
    justifyContent: 'center',
  },
  stepNextBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: theme.textPrimary },
  stepSubmitBtn: { marginTop: 0, marginBottom: 0, minWidth: 168 },
  singleActions: {
    marginTop: 8,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  deleteBtn: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 74, 58, 0.35)',
    backgroundColor: 'rgba(139, 74, 58, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: theme.error },
  singleSubmit: { marginTop: 0, marginBottom: 0, flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.cardBg,
    gap: 10,
  },
  modalTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 22,
    color: theme.textPrimary,
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancel: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textSecondary },
  modalPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.accentGolden,
    minWidth: 88,
    alignItems: 'center',
  },
  modalPrimaryText: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: theme.textPrimary },
  error: { fontFamily: fonts.sansRegular, fontSize: 14, color: theme.error },
  whenPickerBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  whenToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  whenToggleBtn: {
    minWidth: 58,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBg,
    paddingHorizontal: 10,
  },
  whenToggleBtnOn: {
    borderColor: 'rgba(167, 183, 201, 0.65)',
    backgroundColor: theme.pillBg,
  },
  whenToggleBtnText: { fontFamily: fonts.sansMedium, fontSize: 13, color: theme.textSecondary },
  whenToggleBtnTextOn: { fontFamily: fonts.sansSemiBold, color: theme.pillFg },
  pickerCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.cardBg,
    gap: 10,
    maxHeight: '80%',
  },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
  pickerRowText: { fontFamily: fonts.sansMedium, fontSize: 16, color: theme.textPrimary },
});
