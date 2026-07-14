import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";

const GITHUB_REPO_URL = "https://github.com/andresjmorales/cognote";

const STUDIO_FEATURES = [
  {
    icon: "📅",
    title: "Scheduling & Attendance",
    body: "Recurring weekly lessons with one-tap attendance. Times stay correct across daylight saving shifts.",
  },
  {
    icon: "🔄",
    title: "Make-Ups, Your Policy",
    body: "Cancellation windows, banked credits, and expiry are all studio settings, never hardcoded rules.",
  },
  {
    icon: "👨‍👩‍👧",
    title: "No-Login Family Portal",
    body: "One private link per family: schedule, practice links, and notes. Nothing for parents to forget.",
  },
  {
    icon: "✉️",
    title: "Lesson Notes Home",
    body: "Jot a note after the lesson and send it to the family by email and on their portal.",
  },
  {
    icon: "📈",
    title: "Skills & Progress",
    body: "Skill radar charts, trend lines, attendance, and per-note quiz analytics for every student.",
  },
  {
    icon: "🗓️",
    title: "Calendar Feeds",
    body: "Families download or subscribe to an always-current lesson calendar. Cancellations drop out automatically.",
  },
];

const PRACTICE_FEATURES = [
  {
    icon: "🎵",
    title: "Real Staff Notation",
    body: "Notes on a proper staff with clefs, key signatures, and 40+ musical symbols.",
  },
  {
    icon: "🎯",
    title: "Quizzes & Free Practice",
    body: "Note and symbol identification with instant feedback, optionally timed per question.",
  },
  {
    icon: "🧠",
    title: "Spaced Repetition",
    body: "SM-2 flashcards (the Anki algorithm) with kid-friendly emoji ratings.",
  },
  {
    icon: "👦",
    title: "Zero Friction for Kids",
    body: "Open the link, tap Start. No accounts needed, and it works great on tablets.",
  },
];

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface shrink-0">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight"
          >
            <BrandMark
              size={BRAND_ICON_SIZE.header}
              className="h-8 w-8"
            />
            CogNote
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/hosting">
              <Button size="sm" variant="secondary">
                Hosting options
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" variant="secondary">
                Teacher Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4">
        {/* Hero */}
        <section className="text-center pt-14 pb-12">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 font-[family-name:var(--font-nunito)]">
            Run Your Studio.
            <br />
            <span className="text-primary">Grow Your Students.</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto mb-6">
            CogNote is an open-source studio management suite for private music
            teachers: scheduling, attendance, families, and progress tracking,
            with a real practice platform of quizzes and flashcards built in.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/try">
              <Button size="lg" variant="secondary">
                Try a Lesson
              </Button>
            </Link>
          </div>
        </section>

        {/* Studio management */}
        <section className="pb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold font-[family-name:var(--font-nunito)]">
              Everything a private studio needs
            </h2>
            <p className="text-muted text-sm mt-1">
              The back office, handled, so lesson time stays teaching time.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
            {STUDIO_FEATURES.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="text-3xl mb-2">{feature.icon}</div>
                <h3 className="font-semibold mb-0.5">{feature.title}</h3>
                <p className="text-muted text-sm">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Practice & learning */}
        <section className="pb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold font-[family-name:var(--font-nunito)]">
              And students actually practice
            </h2>
            <p className="text-muted text-sm mt-1">
              The learning layer that admin-only tools don&apos;t have. CogNote
              keeps students engaged between lessons.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
            {PRACTICE_FEATURES.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="text-3xl mb-2">{feature.icon}</div>
                <h3 className="font-semibold mb-0.5">{feature.title}</h3>
                <p className="text-muted text-sm">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open source */}
        <section className="pb-14">
          <div className="bg-surface border border-border rounded-2xl px-6 py-8 text-center">
            <h2 className="text-xl font-bold mb-2 font-[family-name:var(--font-nunito)]">
              Open source. Your data is always yours.
            </h2>
            <p className="text-muted text-sm max-w-2xl mx-auto mb-5">
              CogNote is MIT-licensed and free to self-host. Run the full stack
              locally with no cloud accounts required. Want us to host it
              instead? See{" "}
              <a href="/hosting" className="text-primary font-semibold">
                hosting options
              </a>
              . Built by a working piano studio for its own daily use.
            </p>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-semibold bg-foreground text-background hover:opacity-85 px-4 py-2 text-sm rounded-lg transition-opacity"
            >
              <GitHubIcon className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 shrink-0">
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <p>CogNote · Open-source studio management for music teachers</p>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="CogNote on GitHub"
            className="hover:text-foreground transition-colors"
          >
            <GitHubIcon className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}
