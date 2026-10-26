import type { MomentReaction } from './types';

export function canHeartMoment(access: string | null | undefined) {
  return access === 'comment' || access === 'edit';
}

/** Add-only and idempotent, including a concurrent add or a lost POST response. */
export async function ensureMomentHeart(
  userId: number,
  read: () => Promise<MomentReaction[]>,
  add: () => Promise<MomentReaction>,
): Promise<number> {
  const mine = (rows: MomentReaction[]) => rows.some((row) => row.user === userId && row.type === 'heart');
  const reactions = await read();
  if (mine(reactions)) return reactions.length;
  try {
    await add();
    return reactions.length + 1;
  } catch (error) {
    const latest = await read().catch(() => null);
    if (latest && mine(latest)) return latest.length;
    throw error;
  }
}
