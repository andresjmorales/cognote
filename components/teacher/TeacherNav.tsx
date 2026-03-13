"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { usePathname, useRouter } from "next/navigation";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/lessons", label: "Lessons" },
  { href: "/help", label: "Help" },
];

export function TeacherNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/account"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {teacherName}
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted hover:text-foreground cursor-pointer"
          >
            Sign out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-3 -mr-3 text-muted hover:text-foreground cursor-pointer"
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
