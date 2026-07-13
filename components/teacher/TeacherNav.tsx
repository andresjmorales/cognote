"use client";

import { useState } from "react";
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
  { href: "/lessons", label: "Lessons" },
  { href: "/music", label: "Music" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

function HelpIconLink({ active }: { active: boolean }) {
  return (
    <Link
      href="/help"
      aria-label="Help"
      title="Help"
      className={`p-2 rounded-lg transition-colors ${
        active
          ? "text-primary bg-primary/10"
          : "text-muted hover:text-foreground hover:bg-surface-dim"
      }`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </Link>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTeacherTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="p-2 rounded-lg transition-colors text-muted hover:text-foreground hover:bg-surface-dim cursor-pointer"
    >
      {isDark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function TeacherNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const helpActive = pathname.startsWith("/help");

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16 md:h-14">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight"
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

        {/* Desktop account links */}
        <div className="hidden md:flex items-center gap-1">
          <ThemeToggleButton />
          <HelpIconLink active={helpActive} />
          <NotificationBell />
          <Link
            href="/account"
            className="text-sm text-muted hover:text-foreground transition-colors ml-2"
          >
            {teacherName}
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted hover:text-foreground cursor-pointer ml-2"
          >
            Sign out
          </button>
        </div>

        {/* Mobile: theme + help + bell + hamburger */}
        <div className="md:hidden flex items-center gap-0.5">
          <ThemeToggleButton />
          <HelpIconLink active={helpActive} />
          <NotificationBell />
          <button
            className="p-3 -mr-3 text-muted hover:text-foreground cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

      {/* Mobile menu */}
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
          <div className="border-t border-border mt-2 pt-2 flex items-center justify-between px-3">
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              {teacherName}
            </Link>
            <button
              onClick={() => { setMobileOpen(false); handleSignOut(); }}
              className="text-sm text-muted hover:text-foreground cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
