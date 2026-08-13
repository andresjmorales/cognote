"use client";

import { useCallback, useEffect, useId, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ONBOARDING_TOUR_STEPS } from "@/lib/onboarding";

const CARD_WIDTH = 340;

function visibleTourTarget(id: string): DOMRect | null {
  const nodes = document.querySelectorAll(`[data-tour="${id}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 2 && rect.height > 2) return rect;
  }
  return null;
}

function cardPosition(rect: DOMRect | null): CSSProperties {
  if (!rect) {
    return {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${CARD_WIDTH}px, calc(100vw - 2rem))`,
    };
  }

  const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
  const gap = 12;
  let left = Math.min(rect.left, window.innerWidth - width - 16);
  left = Math.max(16, left);

  const estimatedHeight = 260;
  const below = rect.bottom + gap;
  const top =
    below + estimatedHeight > window.innerHeight - 16
      ? Math.max(16, rect.top - estimatedHeight - gap)
      : below;

  return {
    position: "fixed",
    top,
    left,
    width,
  };
}

export function OnboardingTour({ initialShow }: { initialShow: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const titleId = useId();
  const force = searchParams.get("tour") === "1";
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const visible = !dismissed && (initialShow || force);
  const step = ONBOARDING_TOUR_STEPS[stepIndex] ?? ONBOARDING_TOUR_STEPS[0];
  const isLast = stepIndex === ONBOARDING_TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    setRect(visibleTourTarget(step.target));
  }, [step.target]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(measure);
    const retry = window.setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [visible, measure, pathname]);

  const finish = useCallback(async () => {
    setDismissed(true);
    try {
      await fetch("/api/onboarding/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
    } catch {
      /* tour flag is best-effort */
    }
    if (force) {
      router.replace(pathname || "/dashboard");
    }
  }, [force, pathname, router]);

  const go = useCallback(
    (nextIndex: number) => {
      const next = ONBOARDING_TOUR_STEPS[nextIndex];
      if (!next) return;
      setStepIndex(nextIndex);
      if (next.href && next.href !== pathname) {
        router.push(next.href);
      }
    },
    [pathname, router]
  );

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void finish();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible, finish]);

  if (!visible || !step) return null;

  const highlight = step.target ? rect : null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" role="presentation">
      {!highlight && (
        <div className="absolute inset-0 bg-black/45" aria-hidden />
      )}
      {highlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
          style={{
            top: highlight.top - 4,
            left: highlight.left - 4,
            width: highlight.width + 8,
            height: highlight.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      )}
      <div
        key={step.id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 rounded-xl border border-border bg-surface shadow-xl p-4 space-y-3"
        style={cardPosition(highlight)}
      >
        <p className="text-[11px] uppercase tracking-wide text-muted">
          {stepIndex + 1} of {ONBOARDING_TOUR_STEPS.length}
        </p>
        <h2 id={titleId} className="text-base font-semibold">
          {step.title}
        </h2>
        <p className="text-sm text-muted leading-relaxed">{step.body}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            className="text-xs text-muted hover:text-foreground cursor-pointer"
            onClick={() => void finish()}
          >
            Skip
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(stepIndex - 1)}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              autoFocus
              onClick={() => {
                if (isLast) {
                  void finish();
                  return;
                }
                go(stepIndex + 1);
              }}
            >
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
