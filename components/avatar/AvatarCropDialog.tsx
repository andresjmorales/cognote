"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AVATAR_CROP_VIEWPORT,
  AVATAR_OUTPUT_MIME,
  AVATAR_OUTPUT_QUALITY,
  AVATAR_OUTPUT_SIZE,
  AVATAR_ZOOM_MAX,
  AVATAR_ZOOM_MIN,
  AVATAR_ZOOM_STEP,
} from "@/lib/avatar/constants";

type Props = {
  /** Object URL (URL.createObjectURL) for the source image. */
  src: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
  busy?: boolean;
};

/**
 * Square crop with an inscribed circle overlay so the circular avatar
 * result is visible while framing.
 */
function isSafeCropSrc(value: string): boolean {
  // The picker always passes URL.createObjectURL output; anything else
  // (data:, http:, javascript:) is refused rather than rendered.
  return value.startsWith("blob:");
}

export function AvatarCropDialog({ src, onCancel, onConfirm, busy = false }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
  } | null>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(AVATAR_ZOOM_MIN);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  // Crop UI only accepts blob:/data:image/ URLs from createObjectURL / file pick.
  const safeSrc = isSafeCropSrc(src) ? src : undefined;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !exporting) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, exporting, onCancel]);

  const coverScale =
    natural == null
      ? 1
      : Math.max(
          AVATAR_CROP_VIEWPORT / natural.w,
          AVATAR_CROP_VIEWPORT / natural.h
        );
  const scale = coverScale * zoom;
  const drawnW = natural ? natural.w * scale : 0;
  const drawnH = natural ? natural.h * scale : 0;

  const clampPan = useCallback(
    (x: number, y: number, nextZoom = zoom) => {
      if (!natural) return { x: 0, y: 0 };
      const nextScale = coverScale * nextZoom;
      const w = natural.w * nextScale;
      const h = natural.h * nextScale;
      const maxX = Math.max(0, (w - AVATAR_CROP_VIEWPORT) / 2);
      const maxY = Math.max(0, (h - AVATAR_CROP_VIEWPORT) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [coverScale, natural, zoom]
  );

  function onPointerDown(e: React.PointerEvent) {
    if (busy || exporting) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setPan(clampPan(drag.originPanX + dx, drag.originPanY + dy));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  async function handleConfirm() {
    if (!natural || busy || exporting) return;
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");

      const left = AVATAR_CROP_VIEWPORT / 2 + pan.x - drawnW / 2;
      const top = AVATAR_CROP_VIEWPORT / 2 + pan.y - drawnH / 2;
      const sx = (0 - left) / scale;
      const sy = (0 - top) / scale;
      const sw = AVATAR_CROP_VIEWPORT / scale;
      const sh = AVATAR_CROP_VIEWPORT / scale;

      ctx.drawImage(
        imgRef.current!,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, AVATAR_OUTPUT_MIME, AVATAR_OUTPUT_QUALITY);
      });
      if (!blob) throw new Error("Could not encode image");
      await onConfirm(blob);
    } finally {
      setExporting(false);
    }
  }

  const disabled = busy || exporting || !natural;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 border-0 cursor-default"
        aria-label="Cancel crop"
        onClick={() => {
          if (!busy && !exporting) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-surface shadow-xl p-4 space-y-3"
      >
        <h2 id="avatar-crop-title" className="text-base font-semibold">
          Crop profile photo
        </h2>
        <p className="text-xs text-muted">
          Drag to reposition. The circle shows how it will look as your avatar;
          the saved image is a square.
        </p>

        <div
          className="relative mx-auto overflow-hidden touch-none select-none bg-surface-dim rounded-lg cursor-grab active:cursor-grabbing"
          style={{
            width: AVATAR_CROP_VIEWPORT,
            height: AVATAR_CROP_VIEWPORT,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={safeSrc}
            alt=""
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{
              width: drawnW || undefined,
              height: drawnH || undefined,
              left: natural ? AVATAR_CROP_VIEWPORT / 2 + pan.x - drawnW / 2 : 0,
              top: natural ? AVATAR_CROP_VIEWPORT / 2 + pan.y - drawnH / 2 : 0,
              opacity: natural ? 1 : 0,
            }}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNatural({ w: img.naturalWidth, h: img.naturalHeight });
              setZoom(AVATAR_ZOOM_MIN);
              setPan({ x: 0, y: 0 });
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle closest-side, transparent 99.5%, rgba(0,0,0,0.55) 100%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/85 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
            aria-hidden
          />
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted shrink-0 w-12">Zoom</span>
          <input
            type="range"
            min={AVATAR_ZOOM_MIN}
            max={AVATAR_ZOOM_MAX}
            step={AVATAR_ZOOM_STEP}
            value={zoom}
            disabled={disabled}
            onChange={(e) => {
              const next = Number(e.target.value);
              setZoom(next);
              setPan((p) => clampPan(p.x, p.y, next));
            }}
            className="flex-1 accent-primary"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-dim disabled:opacity-40"
            disabled={busy || exporting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-40"
            disabled={disabled}
            onClick={() => void handleConfirm()}
          >
            {busy || exporting ? "Saving…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
