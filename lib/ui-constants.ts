export const BRAND_ICON_SRC = "/icon/cognote.svg";

export const BRAND_ICON_SIZE = {
  header: 32,
  panel: 64,
  loading: 96,
} as const;

export const LOADING_COPY = {
  default: "Loading...",
  flashcards: "Loading flashcards...",
} as const;

/** How many student cards to preview on the teacher dashboard before “View all”. */
export const DASHBOARD_STUDENT_PREVIEW_LIMIT = 5;
