"use client";

import { useEffect } from "react";

/**
 * On hybrid touchscreen laptops, a finger tap leaves :hover stuck on the
 * tapped element until the mouse moves. Toggle html.can-hover so hover
 * utilities (see globals.css) only apply after a real mouse move.
 */
export function TouchHoverGuard() {
  useEffect(() => {
    const root = document.documentElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") root.classList.remove("can-hover");
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") root.classList.add("can-hover");
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return null;
}
