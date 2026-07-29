import { AVATARS_BUCKET, AVATAR_OBJECT_NAME } from "@/lib/avatar/constants";

export function avatarStoragePath(userId: string): string {
  return `${userId}/${AVATAR_OBJECT_NAME}`;
}

/** Append a cache-buster so browsers pick up replacements. */
export function withAvatarCacheBust(publicUrl: string): string {
  const sep = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${sep}v=${Date.now()}`;
}

export { AVATARS_BUCKET };
