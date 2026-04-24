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
  /** Django auth `Group.name` values (e.g. `love`). */
  groups?: string[];
};

export type Profile = {
  person_id: number | null;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  avatar: string | null;
  moments_authored: number;
  moments_shared_with_me: number;
  created_at: string | null;
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
    // Do not send an existing Authorization token when requesting a new token.
    // DRF may reject bad/stale auth headers before this AllowAny view runs.
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
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
  person_id?: number;
  display_name?: string;
  bio?: string;
  avatar?: PhotoUpload;
}): Promise<Profile> {
  const base = getApiBase();
  const body = new FormData();
  if (payload.person_id !== undefined) body.append('person_id', String(payload.person_id));
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

export async function fetchProfileByPerson(personId: number): Promise<Profile> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/profile/people/${personId}/`, {
    headers: baseHeaders(),
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
  /** Person id for author profile route (`/profile/:personId`) when available. */
  author_person_id?: number | null;
  author_username?: string;
  /** Relative media path when author has a linked Person with a profile photo */
  author_avatar?: string | null;
  moment_type?: 'past' | 'looking_ahead' | string;
  countdown_phrase?: string | null;
  kind: string;
  date: string;
  observed_at: string | null;
  calculated_light_at?: string | null;
  title: string;
  bible_verse: string;
  reflection: string;
  original_looking_ahead_note?: string;
  location_name: string;
  latitude: string | null;
  longitude: string | null;
  visibility_mode: string;
  photos: MomentPhoto[];
  tagged_people: TaggedPerson[];
  access_list?: { user_id: number; access_level: string }[];
  my_access: string | null;
  /** From list/detail API; may be omitted on older responses. */
  comments_count?: number;
  reactions_count?: number;
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

export type MomentComment = {
  id: number;
  moment: number;
  author: number;
  author_username?: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type MomentReaction = {
  id: number;
  moment: number;
  user: number;
  user_username?: string;
  type: string;
  created_at: string;
};

export async function fetchMomentComments(momentId: number): Promise<MomentComment[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/comments/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  const data = (await res.json()) as MomentComment[] | { results?: MomentComment[] };
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function createMomentComment(momentId: number, text: string): Promise<MomentComment> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/comments/`, {
    method: 'POST',
    headers: baseHeaders(true),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<MomentComment>;
}

export async function deleteMomentComment(momentId: number, commentId: number): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/comments/${commentId}/`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
}

export async function fetchMomentReactions(momentId: number): Promise<MomentReaction[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/reactions/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  const data = (await res.json()) as MomentReaction[] | { results?: MomentReaction[] };
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function createMomentReaction(momentId: number, type: string): Promise<MomentReaction> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/reactions/`, {
    method: 'POST',
    headers: baseHeaders(true),
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<MomentReaction>;
}

export async function deleteMomentReaction(momentId: number, reactionId: number): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${momentId}/reactions/${reactionId}/`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
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
  /** Relative media path when the user has a linked Person with a profile photo */
  avatar?: string | null;
};

export type Friendship = {
  id: number;
  requester_id: number;
  requester_username: string;
  requester_avatar?: string | null;
  addressee_id: number;
  addressee_username: string;
  addressee_avatar?: string | null;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  created_at: string;
  accepted_at: string | null;
};

export type FriendshipList = {
  accepted: Friendship[];
  pending_incoming: Friendship[];
  pending_outgoing: Friendship[];
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

export async function fetchFriendships(): Promise<FriendshipList> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/friends/`, {
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<FriendshipList>;
}

export async function sendFriendRequest(userId: number): Promise<Friendship> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/friends/requests/`, {
    method: 'POST',
    headers: baseHeaders(true),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Friendship>;
}

export async function acceptFriendRequest(friendshipId: number): Promise<Friendship> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/friends/requests/${friendshipId}/accept/`, {
    method: 'POST',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Friendship>;
}

export async function removeFriend(userId: number): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/friends/${userId}/`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
}

export type CreateMomentPayload = {
  kind: string;
  moment_type?: 'past' | 'looking_ahead';
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

export async function postConvertMoment(
  id: number,
  body: { reflection?: string } = {},
): Promise<Moment> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${id}/convert/`, {
    method: 'POST',
    headers: baseHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json() as Promise<Moment>;
}

export async function deleteMoment(id: number): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/moments/${id}/`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
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
