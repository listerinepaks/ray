import type { CreateMomentPayload } from './types';

export type MomentForm = {
  isEdit: boolean;
  momentType: 'past' | 'looking_ahead';
  kind: string;
  date: string;
  observedAt: string;
  title: string;
  bibleVerse: string;
  reflection: string;
  locationName: string;
  visibility: string;
  selectedPeople: ReadonlySet<number>;
  customRows: ReadonlyArray<{ userId: number; accessLevel: string }>;
};

export function validateMomentForm(
  form: Pick<MomentForm, 'isEdit' | 'momentType' | 'visibility' | 'selectedPeople' | 'customRows'>,
  photoCount: number,
): string | null {
  if (!form.isEdit && form.momentType === 'past' && photoCount === 0) {
    return 'Add at least one photo for a past moment, or choose “Something to look forward to”.';
  }
  if (form.visibility === 'tagged' && form.selectedPeople.size === 0) {
    return 'Choose at least one person to tag, or switch to Friends or Private visibility.';
  }
  if (form.visibility === 'custom' && !form.customRows.some((row) => row.userId > 0)) {
    return 'Add at least one person and access level for custom sharing.';
  }
  return null;
}

export function buildMomentPayload(form: MomentForm): CreateMomentPayload {
  const payload: CreateMomentPayload = {
    kind: form.kind,
    date: form.date,
    visibility_mode: form.visibility,
    title: form.title.trim() || undefined,
    bible_verse: form.bibleVerse.trim(),
    reflection: form.reflection.trim() || undefined,
    location_name: form.locationName.trim() || undefined,
    people: form.visibility === 'tagged'
      ? [...form.selectedPeople].map((person_id) => ({ person_id, role: 'present' }))
      : [],
  };
  if (!form.isEdit) payload.moment_type = form.momentType;
  if (form.observedAt.trim()) {
    const observed = new Date(form.observedAt);
    if (!Number.isNaN(observed.getTime())) payload.observed_at = observed.toISOString();
  } else {
    payload.observed_at = null;
  }
  if (form.visibility === 'custom') {
    payload.access = form.customRows.filter((row) => row.userId > 0)
      .map((row) => ({ user_id: row.userId, access_level: row.accessLevel }));
  }
  return payload;
}
