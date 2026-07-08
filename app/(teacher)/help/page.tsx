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
          Everything you need to know about running your studio on CogNote.
        </p>
      </div>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm leading-relaxed">
          <li>
            <strong>Set up your studio</strong>{" "}in Settings &mdash; studio
            name, timezone, lesson lengths, and your cancellation/make-up
            policy.
          </li>
          <li>
            <strong>Add students</strong>{" "}from the Students tab &mdash;
            just a name is required.
          </li>
          <li>
            <strong>Group students into families</strong>{" "}on the Families
            tab. A family holds the parent&apos;s name and email and gets a
            private portal link. Siblings share one family.
          </li>
          <li>
            <strong>Add weekly lesson slots</strong>{" "}on the Schedule tab so
            each student&apos;s recurring lesson time shows up automatically.
          </li>
          <li>
            <strong>Create a practice lesson</strong>{" "}from the Lessons tab
            and{" "}<strong>assign it</strong>{" "}to a student. If the family
            has an email on file, the practice link is emailed automatically;
            otherwise you can share or copy it.
          </li>
        </ol>
      </Card>

      {/* ---------------- Studio management ---------------- */}
      <SectionHeading
        title="Studio Management"
        blurb="Families, scheduling, attendance, and everything parents see."
      />

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Students &amp; Families</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Students hold everything about the learner: practice assignments,
            analytics, skills, and notes. Families (guardians) hold the
            parent&apos;s contact info and the portal link. Assigning a student
            to a family is what makes emailed lesson notes, practice-link
            emails, and the portal work.
          </p>
          <p className="text-muted">
            If a family&apos;s portal link is ever shared too widely, use{" "}
            <strong>Reset Link</strong>{" "}on the Families page &mdash; the
            old link stops working immediately and a new one is generated.
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
              on your weekly Schedule view. Times are stored in your studio
              timezone, so they stay correct across daylight saving changes.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Marking attendance</h3>
            <p className="text-muted">
              Tap any lesson in the weekly view to mark it: attended, teacher
              cancelled, student cancelled, or no-show. For student
              cancellations, the moment you mark it counts as when notice was
              given &mdash; so mark it when the family tells you, and your
              policy&apos;s cancellation window decides whether it was timely.
            </p>
          </div>
          <div>
            <h3 className="font-medium">One-off lessons</h3>
            <p className="text-muted">
              You can also add a single lesson directly on the schedule
              without creating a recurring slot &mdash; useful for trial
              lessons or occasional extras.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Make-Up Credits</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Your Settings page controls which cancellations earn a make-up
            credit (timely cancels, late cancels, no-shows, teacher cancels)
            and whether credits expire. When a student has an unused credit,
            you can schedule a make-up lesson from the Schedule tab, and
            CogNote links it to the original cancellation so nothing is
            double-counted.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Lesson Notes &amp; Email</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Every lesson can have a note (&ldquo;today we covered X, practice Y
            this             week&rdquo;). Notes are private by default. Use{" "}
            <strong>Save &amp; Email Family</strong>{" "}to send the note to
            the family&apos;s email and post it on their portal. Replies go
            straight to your email address, not to CogNote.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">The Family Portal</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Each family gets one private link with everything they need: their
            students&apos; practice links, the upcoming lesson schedule, notes
            you&apos;ve shared, your studio info, and a calendar they can
            download or subscribe to. No account or password required &mdash;
            remind parents to keep the link private, and reset it from the
            Families page if needed.
          </p>
          <p className="text-muted">
            Students never see the portal. Practice links show only practice;
            schedules and family details stay parent-facing.
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Skills &amp; Progress</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            On each student&apos;s page you can rate them 1&ndash;5 across
            skill dimensions like Musicianship, Rhythm, and Sight Reading
            (add or rename dimensions to fit how you teach). Ratings build a
            radar chart of current levels and trend lines over time, next to
            quiz analytics and an attendance summary.
          </p>
          <p className="text-muted">
            The optional{" "}<strong>level</strong>{" "}field next to the student name
            anchors them to whatever system you use (RCM level, Faber book,
            or your own).
          </p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Studio Settings &amp; Policies</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-muted">
            Settings holds your studio name, timezone, lesson lengths, and
            your cancellation/make-up policy. It also has an{" "}
            <strong>About the Studio</strong>{" "}section (policies in your own
            words, website, contact info) that appears on every family portal.
            All of it is per-studio configuration &mdash; CogNote never
            hardcodes anyone&apos;s rules.
          </p>
        </div>
      </Card>

      {/* ---------------- Practice & lessons ---------------- */}
      <SectionHeading
        title="Practice & Lessons"
        blurb="The quizzes, flashcards, and practice links your students use."
      />

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Templates vs Student-Specific Lessons</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Templates</h3>
            <p className="text-muted">
              Templates are reusable lesson blueprints. When you assign a template to a student,
              CogNote creates a{" "}<em>copy</em>{" "}of it as a student-specific lesson. Changes to the
              template afterwards won&apos;t affect already-assigned copies.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Student-Specific Lessons</h3>
            <p className="text-muted">
              These are individual lessons tied to one student. You can edit them directly to
              fine-tune what that particular student is working on. Student-specific lessons can
              also be assigned &mdash; for example, if a student lost their link or you want to
              share the same custom lesson with a sibling.
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
              Students see a note on the staff and pick its name from multiple-choice answers.
              You can choose the clef, key signature, accidentals, and specific notes to include.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Key Signature Identification</h3>
            <p className="text-muted">
              Students see a key signature on the staff and identify which key it is. You choose
              which keys to include.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Musical Symbols &amp; Concepts</h3>
            <p className="text-muted">
              Students are quizzed on musical terms, symbols, and their meanings &mdash; dynamics,
              tempo markings, articulations, note values, and more. You select which symbols to
              include from the built-in library.
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
              A fixed number of questions (set in the lesson). Scores are recorded and visible on
              the student&apos;s detail page. You can optionally add a per-question time limit
              (5&ndash;60 seconds) &mdash; unanswered questions count as incorrect. The timer
              applies to quiz mode only.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Free Practice</h3>
            <p className="text-muted">
              Unlimited questions with no timer &mdash; the student practices at their own pace
              and quits whenever they want.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Flashcards</h3>
            <p className="text-muted">
              Uses spaced repetition (SM-2 algorithm, like Anki) to focus on the notes or concepts
              the student struggles with most. Cards the student knows well &ldquo;graduate&rdquo;
              from the session, while tricky ones keep reappearing.
            </p>
            <p className="text-muted mt-1">
              Ratings use kid-friendly labels:&nbsp;
              <strong>No clue 😕</strong>{" "}&bull;&nbsp;
              <strong>Tricky 🤔</strong>{" "}&bull;&nbsp;
              <strong>Got it 👍</strong>{" "}&bull;&nbsp;
              <strong>Easy! ⭐</strong>
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Student Notes &amp; Difficulty</h2>
        <p className="text-sm text-muted leading-relaxed">
          Each lesson can have a difficulty level (beginner / intermediate / advanced) and a
          teacher notes field for your own reminders. Students also have their own notes field
          on their detail page &mdash; great for tracking lesson observations, practice
          instructions, or anything you want to remember for that student.
        </p>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Sharing Practice Links</h2>
        <p className="text-sm text-muted leading-relaxed">
          When you assign a lesson, CogNote emails the practice link to the student&apos;s family
          automatically if an email is on file (the email includes their portal link too). With no
          family email, you get a share/copy option instead so you can send it over any messenger.
          The student opens the link in any browser &mdash; no account needed. Each link is unique
          per student+lesson and stays active until you remove the assignment.
        </p>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Tips</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted leading-relaxed">
          <li>
            Start simple &mdash; a 5-note Middle C position lesson with 10 questions is
            a great first assignment.
          </li>
          <li>
            Use flashcard mode for students who need extra drilling on specific notes.
          </li>
          <li>
            Check the student detail page to see per-note accuracy and session history.
          </li>
          <li>
            Edit a student-specific lesson anytime to add or remove notes as they progress.
          </li>
          <li>
            Mark attendance right after each lesson and jot the note while it&apos;s fresh &mdash;
            emailing it to the family takes one tap.
          </li>
          <li>
            Encourage parents to subscribe to the portal calendar so schedule changes reach them
            automatically.
          </li>
          <li>
            Rate skills every few weeks rather than every lesson &mdash; the trend lines are more
            meaningful with a little space between ratings.
          </li>
        </ul>
      </Card>
    </div>
  );
}
