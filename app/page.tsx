import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="text-xl font-bold text-primary tracking-tight">
            CogNote
          </span>
          <Link href="/login">
            <Button size="sm" variant="secondary">
              Teacher Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-4">
        <section className="py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 font-[family-name:var(--font-nunito)]">
            Music Note Practice
            <br />
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto mb-8">
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
        <section className="py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-3">🎵</div>
            <h3 className="font-semibold text-lg mb-1">
              Real Staff Notation
            </h3>
            <p className="text-muted text-sm">
              Notes rendered on a proper music staff with clefs and key
              signatures. Students learn to read real notation.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🔗</div>
            <h3 className="font-semibold text-lg mb-1">Share via Link</h3>
            <p className="text-muted text-sm">
              Generate a unique practice URL for each student. No accounts,
              no passwords — just tap and practice.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-lg mb-1">Track Progress</h3>
            <p className="text-muted text-sm">
              See which notes each student struggles with. Accuracy breakdowns,
              session history, and practice trends.
            </p>
          </div>
        </section>

        <section className="py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-3">🧠</div>
            <h3 className="font-semibold text-lg mb-1">Spaced Repetition</h3>
            <p className="text-muted text-sm">
              Built-in flashcard mode uses the SM-2 algorithm to optimize
              long-term memorization.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold text-lg mb-1">Customizable Plans</h3>
            <p className="text-muted text-sm">
              Choose specific notes, clefs, key signatures, and difficulty.
              Create reusable templates or student-specific plans.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">👶</div>
            <h3 className="font-semibold text-lg mb-1">Kid-Friendly</h3>
            <p className="text-muted text-sm">
              Large buttons, friendly feedback, and gentle animations.
              Designed for young learners ages 5–14.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        <p>CogNote — Open source music education tool</p>
      </footer>
    </div>
  );
}
