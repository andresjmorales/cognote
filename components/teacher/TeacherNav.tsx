"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/plans", label: "Plans" },
  { href: "/help", label: "Help" },
];

export function TeacherNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-xl font-bold text-primary tracking-tight"
          >
            CogNote
          </Link>
          <nav className="flex gap-1">
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

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{teacherName}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted hover:text-foreground cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
