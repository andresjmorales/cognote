import { Card } from "@/components/ui/card";

export const metadata = { title: "Help" };

function SectionHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted text-sm mt-1">{blurb}</p>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help &amp; Guide</h1>
        <p className="text-muted">
          How to run your studio day to day on CogNote.
        </p>
      </div>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm leading-relaxed">
          <li>
            <strong>Set up your studio</strong> under Studio: studio name,
            lesson lengths, and your cancellation/make-up policy. Set timezone
            in Account settings (defaults from your browser at signup).
          </li>
          <li>
            <strong>Add students</strong> from the Students tab. A name is
            enough to start. Add an email/phone (or mark adult student) to
            create a family portal automatically, or upload a spreadsheet under
            Account settings → Import students.
          </li>
          <li>
            <strong>Group students into families</strong> on the Families tab
            when siblings share a household. Moving the last student out of a
            singleton family retires that empty family (unless it has invoices).
          </li>
          <li>
            <strong>Add weekly lesson slots</strong> on the Schedule tab so
            each student&apos;s recurring lesson time shows up automatically.
          </li>
          <li>
            <strong>Create a practice lesson</strong> from the Lessons tab and{" "}
            <strong>assign it</strong> to a student. If the family has an email
            on file, the practice link is emailed automatically (including the
            lesson title). Otherwise you can share or copy it.
          </li>
          <li>
            Optional: set a default rate in Studio → Rates, then generate
            invoices from attendance on the Billing tab.
          </li>
        </ol>
      </Card>

      {/* ---------------- Studio management ---------------- */}
      <SectionHeading
        title="Studio Management"
        blurb="Families, scheduling, attendance, billing, and what parents see."
      />

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Students &amp; Families</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Students hold practice assignments, analytics, skills, and notes.
            Families hold parent contact info and the portal link. When you add
            a student with an email or phone (or mark them as an adult
            student), CogNote creates a singleton family so portal and billing
            work immediately. Linking a student into another family moves them;
            empty singleton families without invoices are removed.
          </p>
          <p className="text-muted">
            If a portal link is shared too widely, use{" "}
            <strong>Reset Link</strong> on the Families page. The old link stops
            working immediately and a new one is generated.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Scheduling &amp; Attendance</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Weekly slots</h3>
            <p className="text-muted">
              A slot is a recurring lesson time (for example, Tuesdays at 4:00
              PM for 30 minutes). CogNote turns slots into individual lessons
              on your weekly Schedule view. Times stay correct across daylight
              saving changes because they use your studio timezone.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Marking attendance</h3>
            <p className="text-muted">
              Tap any lesson in the weekly view to mark it: attended, teacher
              cancelled, student cancelled, or no-show. Teacher cancellations
              email the family by default (optional note; you can turn email
              off). For student cancellations, choose when notice was given
              (just now, timely, late, or a specific time) so billing and
              make-ups follow your cancellation window. Use{" "}
              <strong>Bulk mark attendance</strong> under the week grid for
              Attended / No-show / Teacher cancelled only.
            </p>
          </div>
          <div>
            <h3 className="font-medium">One-off lessons</h3>
            <p className="text-muted">
              You can add a single lesson on the schedule without a recurring
              slot. Useful for trials or occasional extras.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Billing &amp; Payments</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Set your default rate (per lesson or per hour) and billability rules
            in Studio → Rates. Payment instructions and Stripe live under
            Billing → Payment settings. Optional per-student and per-slot rates
            override the studio default. On the Billing tab, generate draft
            invoices for a date range from marked attendance, edit line items,
            then Send to email a PDF and post the invoice to the family portal.
          </p>
          <p className="text-muted">
            Payments default to manual (mark paid yourself). To accept cards,
            open Billing → Payment settings, switch to Stripe, and paste your
            own keys. CogNote never holds platform payment keys for lesson
            tuition.
          </p>
          <p className="text-muted">
            When a family pays online, the Stripe webhook marks the invoice
            paid and can email you a short receipt (family, amount, period).
            Turn that on or off under Account settings → Notifications.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Make-Up Credits</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Studio → Make-up policy controls which cancellations earn a make-up
            credit (timely cancels, late cancels, no-shows, teacher cancels)
            and whether credits expire. When a student has an unused credit,
            schedule a make-up from the Schedule tab. CogNote links it to the
            original cancellation so nothing is double-counted.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Lesson Notes &amp; Email</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Every lesson can have a note (&ldquo;today we covered X, practice Y
            this week&rdquo;). Notes are private by default. Use{" "}
            <strong>Save &amp; Email Family</strong> to send the family-facing
            note by email and post it on their portal. Replies go to your email
            address, not to CogNote.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">The Family Portal</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Each family gets one private link with practice links, assigned
            sheet music, the upcoming schedule (parents can cancel with an
            optional note), notes you&apos;ve shared, invoices, your studio
            info, and a calendar download/subscribe URL. No account or password.
            Remind parents to keep the link private; reset it from Families if
            needed.
          </p>
          <p className="text-muted">
            Portal cancellations show in your notification bell, and optionally
            by email (Account settings → Notifications). Students never see the
            portal; practice links show only practice.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Sheet Music</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Under Music Library you can upload PDF or MusicXML/MXL files, edit
            metadata (title, composer, license, tags), and assign scores to
            students with an optional note and due date. Families view and
            download assignments in the portal.
          </p>
          <p className="text-muted">
            Use Find Scores to search Mutopia (PDF import for Public Domain /
            CC BY) and OpenScore Lieder (MXL import). OpenScore Quartets and
            IMSLP are link-out only. Assign emails include the piece title in
            the subject and body when a family email is on file.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Skills &amp; Progress</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            On each student&apos;s page you can rate them 1&ndash;5 across skill
            dimensions like Musicianship, Rhythm, and Sight Reading (add or
            rename dimensions to fit how you teach). Ratings build a radar chart
            and trend lines, next to quiz analytics and an attendance summary.
          </p>
          <p className="text-muted">
            The optional <strong>level</strong> field next to the student name
            anchors them to whatever system you use (RCM level, Faber book, or
            your own).
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Studio, Account &amp; Data</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            <strong>Studio</strong> holds studio name, lesson lengths,
            cancellation/make-up policy, rates, and practice streaks. The{" "}
            <strong>About the Studio</strong> section (policies in your own
            words, website, contact) appears on every family portal.
          </p>
          <p className="text-muted">
            <strong>Account settings</strong> holds timezone, notifications,
            optional AI, spreadsheet import, and full data export/import.
            Mapping works without AI; an optional BYO key under Optional AI can
            suggest column mappings.
          </p>
          <p className="text-muted">
            Use Export / Import under Account settings to back up or move studio
            data (treat export files as confidential; they can include payment
            keys). Configure Stripe or payment instructions from Billing →
            Payment settings.
          </p>
        </div>
      </Card>

      {/* ---------------- Practice & lessons ---------------- */}
      <SectionHeading
        title="Practice & Lessons"
        blurb="Quizzes, flashcards, and practice links your students use."
      />

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Templates vs Student-Specific Lessons</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Templates</h3>
            <p className="text-muted">
              Templates are reusable lesson blueprints. Assigning a template
              creates a <em>copy</em> as a student-specific lesson. Later
              template edits do not change already-assigned copies.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Student-Specific Lessons</h3>
            <p className="text-muted">
              These are tied to one student. Edit them to fine-tune what that
              student is working on. You can re-assign (for example if they
              lost the link) or share a custom lesson with a sibling.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Lesson Types</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Note Identification</h3>
            <p className="text-muted">
              Students see a note on the staff and pick its name. You choose
              clef, key signature, accidentals, and which notes to include.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Key Signature Identification</h3>
            <p className="text-muted">
              Students see a key signature and identify the key. You choose
              which keys to include.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Musical Symbols &amp; Concepts</h3>
            <p className="text-muted">
              Quizzes on musical terms and symbols: dynamics, tempo markings,
              articulations, note values, and more. Pick symbols from the
              built-in library.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Practice Modes</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Lesson</h3>
            <p className="text-muted">
              A fixed number of questions. Scores appear on the student&apos;s
              detail page. Optional per-question time limit (5&ndash;60
              seconds); unanswered questions count as incorrect. Timer applies
              to quiz mode only.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Free Practice</h3>
            <p className="text-muted">
              Unlimited questions, no timer. The student practices at their own
              pace and quits whenever they want.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Flashcards</h3>
            <p className="text-muted">
              Spaced repetition (SM-2, like Anki) focuses on notes or concepts
              the student struggles with. Cards they know well graduate from
              the session; tricky ones keep returning.
            </p>
            <p className="text-muted mt-1">
              Ratings:&nbsp;
              <strong>No clue 😕</strong>{" "}&bull;&nbsp;
              <strong>Tricky 🤔</strong>{" "}&bull;&nbsp;
              <strong>Got it 👍</strong>{" "}&bull;&nbsp;
              <strong>Easy! ⭐</strong>
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Student Notes &amp; Plan Labels</h2>
        <p className="text-sm text-muted leading-relaxed">
          Each lesson can have optional labels (Easy, Intermediate, Advanced,
          Fundamentals, or your own tags) for organizing plans — they do not
          change how the quiz works. Students also have a notes field on their
          detail page for lesson observations or practice instructions.
        </p>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Sharing Practice Links</h2>
        <p className="text-sm text-muted leading-relaxed">
          Assigning a lesson emails the practice link (and lesson title) to the
          family when an email is on file, plus their portal link in the
          footer. With no family email, you get a share/copy option instead.
          The student opens the link in any browser; no account needed. Each
          link is unique per student+lesson until you remove the assignment.
        </p>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Tips</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted leading-relaxed">
          <li>
            Start simple: a 5-note Middle C position lesson with 10 questions
            is a solid first assignment.
          </li>
          <li>
            Use flashcard mode for students who need extra drilling on specific
            notes.
          </li>
          <li>
            Check the student detail page for per-note accuracy and session
            history.
          </li>
          <li>
            Edit a student-specific lesson anytime to add or remove notes as
            they progress.
          </li>
          <li>
            Mark attendance right after each lesson and jot the note while
            it&apos;s fresh. Emailing the family takes one tap.
          </li>
          <li>
            Encourage parents to subscribe to the portal calendar so schedule
            changes reach them automatically.
          </li>
          <li>
            Rate skills every few weeks rather than every lesson. Trend lines
            are clearer with a little space between ratings.
          </li>
        </ul>
      </Card>
    </div>
  );
}
