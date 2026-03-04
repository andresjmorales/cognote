import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface shrink-0">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight">
            <img
              src="/icon/cognote.svg"
              alt=""
              className="h-8 w-8"
              width={32}
              height={32}
            />
            CogNote
          </span>
          <Link href="/login">
            <Button size="sm" variant="secondary">
              Teacher Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero + Features */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto px-4">
        <section className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 font-[family-name:var(--font-nunito)]">
            Music Note Practice
            <br />
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto mb-6">
            CogNote helps piano teachers assign and track note memorization
            exercises. Students practice through fun quizzes and flashcards —
            no login required.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/practice/dev-token-emma-week1">
              <Button size="lg" variant="secondary">
                Try a Demo
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
          <div className="text-center">
            <div className="text-3xl mb-2">🎵</div>
            <h3 className="font-semibold mb-0.5">Real Staff Notation</h3>
            <p className="text-muted text-sm">
              Notes on a proper music staff with clefs and key signatures.
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🔗</div>
            <h3 className="font-semibold mb-0.5">Share via Link</h3>
            <p className="text-muted text-sm">
              Unique practice URL per student. No accounts needed.
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-semibold mb-0.5">Track Progress</h3>
            <p className="text-muted text-sm">
              Per-note accuracy, session history, and practice trends.
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🧠</div>
            <h3 className="font-semibold mb-0.5">Spaced Repetition</h3>
            <p className="text-muted text-sm">
              SM-2 flashcards optimize long-term memorization.
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="font-semibold mb-0.5">Customizable Lesson Plans</h3>
            <p className="text-muted text-sm">
              Notes, symbols, clefs, keys — reusable templates or per-student.
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">👦</div>
            <h3 className="font-semibold mb-0.5">Kid-Friendly</h3>
            <p className="text-muted text-sm">
              Large buttons, friendly feedback. Designed for ages 5–14.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-sm text-muted shrink-0">
        <p>CogNote — Open source music education tool</p>
      </footer>
    </div>
  );
}
