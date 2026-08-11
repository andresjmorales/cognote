import { describe, expect, it } from "vitest";
import {
  isRetryableUploadStatus,
  messageFromUploadResponse,
} from "./upload-errors";

describe("upload error helpers", () => {
  it("prefers JSON error bodies", async () => {
    const res = new Response(JSON.stringify({ error: "Failed to store file" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    await expect(messageFromUploadResponse(res)).resolves.toEqual({
      message: "Failed to store file",
    });
  });

  it("surfaces existingId for duplicates", async () => {
    const res = new Response(
      JSON.stringify({
        error: "This file is already in your library",
        existingId: "abc",
      }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    await expect(messageFromUploadResponse(res)).resolves.toEqual({
      message: "This file is already in your library",
      existingId: "abc",
    });
  });

  it("maps non-JSON 413 to a size message", async () => {
    const res = new Response("<html>too large</html>", {
      status: 413,
      headers: { "content-type": "text/html" },
    });
    const result = await messageFromUploadResponse(res);
    expect(result.message).toMatch(/too large/i);
  });

  it("includes status for opaque server errors", async () => {
    const res = new Response("<html>oops</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });
    await expect(messageFromUploadResponse(res)).resolves.toEqual({
      message: "Upload failed (server error 502). Please try again.",
    });
  });

  it("marks transient statuses retryable", () => {
    expect(isRetryableUploadStatus(502)).toBe(true);
    expect(isRetryableUploadStatus(400)).toBe(false);
    expect(isRetryableUploadStatus(409)).toBe(false);
  });
});
