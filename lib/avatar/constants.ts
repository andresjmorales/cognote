/** Public Storage bucket for teacher profile photos. */
export const AVATARS_BUCKET = "avatars";

/** Fixed object key under `{userId}/`. */
export const AVATAR_OBJECT_NAME = "avatar.webp";

/** Square output edge length in pixels. */
export const AVATAR_OUTPUT_SIZE = 512;

/** Crop UI viewport (CSS px); circle overlay is inscribed. */
export const AVATAR_CROP_VIEWPORT = 280;

/** Reject source files larger than this before crop. */
export const AVATAR_MAX_INPUT_BYTES = 8 * 1024 * 1024;

export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export const AVATAR_OUTPUT_MIME = "image/webp";
export const AVATAR_OUTPUT_QUALITY = 0.88;

export const AVATAR_ZOOM_MIN = 1;
export const AVATAR_ZOOM_MAX = 3;
export const AVATAR_ZOOM_STEP = 0.01;
