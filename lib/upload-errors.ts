/**
 * Turn a failed upload Response into a teacher-facing message.
 * Non-JSON platform pages (413, gateway HTML, etc.) previously collapsed to
 * a bare "Upload failed" with no status clue.
 */
export async function messageFromUploadResponse(
  res: Response
): Promise<{ message: string; existingId?: string }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await res.json().catch(() => ({}))) as {
      error?: unknown;
      existingId?: unknown;
    };
    const error =
      typeof json.error === "string" && json.error.trim() ? json.error : null;
    const existingId =
      typeof json.existingId === "string" ? json.existingId : undefined;
    if (error) return { message: error, existingId };
  } else {
    await res.text().catch(() => "");
  }

  if (res.status === 413) {
    return {
      message: "File is too large for the server to accept. Try a smaller PDF.",
    };
  }
  if (res.status === 401) {
    return { message: "Session expired. Sign in again, then retry the upload." };
  }
  if (res.status >= 500) {
    return {
      message: `Upload failed (server error ${res.status}). Please try again.`,
    };
  }
  if (res.status > 0) {
    return { message: `Upload failed (HTTP ${res.status}). Please try again.` };
  }
  return { message: "Upload failed. Please try again." };
}

export function isRetryableUploadStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}
