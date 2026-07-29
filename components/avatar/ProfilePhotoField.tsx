"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarCropDialog } from "@/components/avatar/AvatarCropDialog";
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_OUTPUT_MIME,
} from "@/lib/avatar/constants";
import {
  AVATARS_BUCKET,
  avatarStoragePath,
  withAvatarCacheBust,
} from "@/lib/avatar/paths";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialUrl: string | null;
  displayName: string;
  onUrlChange?: (url: string | null) => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ProfilePhotoField({
  initialUrl,
  displayName,
  onUrlChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function openPicker() {
    setMessage(null);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Choose an image file" });
      return;
    }
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setMessage({ type: "error", text: "Image must be under 8 MB" });
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
  }

  async function uploadCropped(blob: Blob) {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const path = avatarStoragePath(user.id);
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, {
          contentType: AVATAR_OUTPUT_MIME,
          upsert: true,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = withAvatarCacheBust(data.publicUrl);

      const res = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Failed to save photo"
        );
      }

      setUrl(publicUrl);
      onUrlChange?.(publicUrl);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setMessage({ type: "success", text: "Photo updated" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Could not upload photo",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const path = avatarStoragePath(user.id);
      await supabase.storage.from(AVATARS_BUCKET).remove([path]);

      const res = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Failed to remove photo"
        );
      }

      setUrl(null);
      onUrlChange?.(null);
      setMessage({ type: "success", text: "Photo removed" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Could not remove photo",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Profile photo</div>
      <div className="flex items-center gap-4">
        <div
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface-dim text-sm font-semibold flex items-center justify-center text-foreground ring-1 ring-border"
          aria-hidden
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsFromName(displayName)
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-dim disabled:opacity-40 cursor-pointer"
          >
            {url ? "Change photo" : "Upload photo"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => void removePhoto()}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-dim disabled:opacity-40 cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="hidden"
        onChange={onFileChange}
      />
      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-success" : "text-error"
          }`}
        >
          {message.text}
        </p>
      )}
      {cropSrc && (
        <AvatarCropDialog
          src={cropSrc}
          busy={busy}
          onCancel={() => {
            if (busy) return;
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onConfirm={uploadCropped}
        />
      )}
    </div>
  );
}
