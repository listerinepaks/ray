/**
 * Django API client. Native uses `Authorization: Token …` (see `/api/auth/token/`).
 * Set `EXPO_PUBLIC_API_URL` (e.g. `http://192.168.1.10:8000` for a device on your LAN).
 */

let authToken: string | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

export function getApiBase(): string {
  const env = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (env) return env;
  return 'http://127.0.0.1:8000';
}

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = getApiBase().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function formatErrorJson(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map(String).join(', ');
    const parts: string[] = [];
    for (const [k, v] of Object.entries(j)) {
      if (k === 'detail') continue;
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
      else if (typeof v === 'string') parts.push(`${k}: ${v}`);
      else if (v != null) parts.push(`${k}: ${JSON.stringify(v)}`);
    }
    if (parts.length) return parts.join(' · ');
  } catch {
    /* ignore */
  }
  return text || `${status}`.trim();
}

async function parseErrorBody(res: Response): Promise<string> {
  const text = await res.text();
  return formatErrorJson(text, res.status);
}

function baseHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (authToken) h.Authorization = `Token ${authToken}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export type Me = {
  id: number;
  username: string;
  email: string;
};

export type Profile = {
  username: string;
  email: string;
  display_name: string;
  bio: string;
  avatar: string | null;
  moments_authored: number;
  moments_shared_with_me: number;
  created_at: string;
  updated_at: string;
};

export async function fetchMe(): Promise<Me | null> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/me/`, {
    headers: baseHeaders(),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Me>;
}

export async function postTokenLogin(username: string, password: string): Promise<{ token: string } & Me> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/token/`, {
    method: 'POST',
    headers: { ...baseHeaders(true) },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<{ token: string } & Me>;
}

export async function postTokenRevoke(): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/token/revoke/`, {
    method: 'POST',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
}

export async function fetchProfile(): Promise<Profile> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/profile/me/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Profile>;
}

export async function updateProfile(payload: {
  display_name?: string;
  bio?: string;
  avatar?: PhotoUpload;
}): Promise<Profile> {
  const base = getApiBase();
  const body = new FormData();
  if (payload.display_name !== undefined) body.append('display_name', payload.display_name);
  if (payload.bio !== undefined) body.append('bio', payload.bio);
  if (payload.avatar) {
    body.append(
      'avatar',
      { uri: payload.avatar.uri, name: payload.avatar.name, type: payload.avatar.type } as unknown as Blob,
    );
  }
  const res = await fetch(`${base}/api/profile/me/`, {
    method: 'PATCH',
    headers: baseHeaders(),
    body,
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Profile>;
}

export type MomentPhoto = {
  id: number;
  image: string;
  caption: string;
  sort_order: number;
  created_at: string;
};

export type TaggedPerson = {
  id: number;
  name: string;
  linked_user: number | null;
  role: string;
};

export type Moment = {
  id: number;
  author: number;
  kind: string;
  date: string;
  observed_at: string | null;
  title: string;
  bible_verse: string;
  reflection: string;
  location_name: string;
  latitude: string | null;
  longitude: string | null;
  visibility_mode: string;
  photos: MomentPhoto[];
  tagged_people: TaggedPerson[];
  access_list?: { user_id: number; access_level: string }[];
  my_access: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchMoments(): Promise<Moment[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  const data = (await res.json()) as Moment[] | { results?: Moment[] };
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  return [];
}

export class MomentNotFoundError extends Error {
  constructor() {
    super('Moment not found.');
    this.name = 'MomentNotFoundError';
  }
}

export async function fetchMoment(id: number): Promise<Moment> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${id}/`, {
    headers: baseHeaders(),
  });
  if (res.status === 404) throw new MomentNotFoundError();
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Moment>;
}

export type Person = {
  id: number;
  name: string;
  linked_user: number | null;
  profile_photo: string | null;
  note: string;
  created_at: string;
};

export async function fetchPeople(): Promise<Person[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/people/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  const data = (await res.json()) as Person[] | { results?: Person[] };
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  return [];
}

export async function createPerson(payload: { name: string; note?: string }): Promise<Person> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/people/`, {
    method: 'POST',
    headers: baseHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Person>;
}

export type SharingUser = {
  id: number;
  username: string;
};

export async function fetchSharingUsers(): Promise<SharingUser[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/users/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  const data = (await res.json()) as { users: SharingUser[] };
  return data.users ?? [];
}

export type CreateMomentPayload = {
  kind: string;
  date: string;
  observed_at?: string | null;
  title?: string;
  bible_verse?: string;
  reflection?: string;
  location_name?: string;
  latitude?: string | null;
  longitude?: string | null;
  visibility_mode: string;
  people?: { person_id: number; role?: string }[];
  access?: { user_id: number; access_level: string }[];
};

export async function createMoment(payload: CreateMomentPayload): Promise<Moment> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/`, {
    method: 'POST',
    headers: baseHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Moment>;
}

export async function updateMoment(id: number, payload: CreateMomentPayload): Promise<Moment> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${id}/`, {
    method: 'PATCH',
    headers: baseHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Moment>;
}

export async function deleteMomentPhoto(momentId: number, photoId: number): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/photos/${photoId}/`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
}

export async function patchMomentPhoto(
  momentId: number,
  photoId: number,
  payload: { caption: string },
): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/photos/${photoId}/`, {
    method: 'PATCH',
    headers: baseHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
}

export type PhotoUpload = { uri: string; name: string; type: string };

export async function uploadMomentPhoto(
  momentId: number,
  file: PhotoUpload,
  caption: string,
  sortOrder: number,
): Promise<void> {
  const base = getApiBase();
  const body = new FormData();
  // React Native file upload shape (not a web Blob)
  body.append('image', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  body.append('caption', caption);
  body.append('sort_order', String(sortOrder));
  const res = await fetch(`${base}/api/moments/${momentId}/photos/`, {
    method: 'POST',
    headers: baseHeaders(),
    body,
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
}
