"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { usePathname, useRouter } from "next/navigation";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/teacher/NotificationBell";
import { useTeacherTheme } from "@/components/teacher/TeacherThemeProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/families", label: "Families" },
  { href: "/schedule", label: "Schedule" },
  { href: "/events", label: "Events" },
  { href: "/lessons", label: "Lessons" },
  { href: "/music", label: "Music" },
  { href: "/billing", label: "Billing" },
  { href: "/studio", label: "Studio" },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function AccountMenu({
  teacherName,
  avatarUrl,
}: {
  teacherName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTeacherTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";
  const accountActive = pathname.startsWith("/account");
  const helpActive = pathname.startsWith("/help");

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        title={teacherName}
        className={`flex items-center justify-center h-9 w-9 rounded-full text-xs font-semibold transition-colors cursor-pointer overflow-hidden ${
          open || accountActive
            ? avatarUrl
              ? "ring-2 ring-primary ring-offset-2 ring-offset-surface"
              : "bg-primary text-white"
            : avatarUrl
              ? "ring-1 ring-border hover:ring-primary/50"
              : "bg-surface-dim text-foreground hover:bg-border"
        }`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initialsFromName(teacherName)
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-surface shadow-lg z-50 py-1 overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-border">
            <div className="text-sm font-semibold truncate">{teacherName}</div>
            <div className="text-[11px] text-muted">Teacher account</div>
          </div>

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`block px-3 py-2.5 text-sm transition-colors ${
              accountActive
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-surface-dim"
            }`}
          >
            Account settings
          </Link>

          <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="text-foreground">Dark mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleTheme();
              }}
              className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 ${
                isDark ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isDark ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <Link
            href="/help"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`block px-3 py-2.5 text-sm transition-colors ${
              helpActive
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-surface-dim"
            }`}
          >
            Help
          </Link>

          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-surface-dim cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherNav({
  teacherName,
  avatarUrl,
}: {
  teacherName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16 md:h-14">
        <div className="flex items-center gap-8 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight shrink-0"
          >
            <BrandMark
              size={BRAND_ICON_SIZE.header}
              className="h-8 w-8"
            />
            CogNote
          </Link>
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:text-foreground hover:bg-surface-dim"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />
          <AccountMenu teacherName={teacherName} avatarUrl={avatarUrl} />
          <button
            type="button"
            className="md:hidden p-2.5 -mr-2 text-muted hover:text-foreground cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface px-4 pb-3 pt-2 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:text-foreground hover:bg-surface-dim"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
