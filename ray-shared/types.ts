// API data shared by the web and native clients. Platform transports remain separate.

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
  /** Auth user id when this profile is linked to an account (filter moments by `author`). */
  linked_user?: number | null;
  display_name: string;
  bio: string;
  avatar: string | null;
  moments_authored: number;
  moments_shared_with_me: number;
  created_at: string | null;
};

export type MomentPhoto = {
  id: number;
  image: string;
  thumbnail: string | null;
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
  /** Linked Person id used by client profile routes when available. */
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

export type Person = {
  id: number;
  name: string;
  linked_user: number | null;
  profile_photo: string | null;
  note: string;
  created_at: string;
};

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
