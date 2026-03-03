import { Card } from "@/components/ui/card";

export const metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help &amp; Guide</h1>
        <p className="text-muted">
          Everything you need to know about using CogNote with your students.
        </p>
      </div>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm leading-relaxed">
          <li>
            <strong>Add students</strong> from the Students tab &mdash; just a name is required.
          </li>
          <li>
            <strong>Create a lesson plan</strong> from the Lesson Plans tab. Choose between note identification
            and musical symbols/concepts.
          </li>
          <li>
            <strong>Assign the lesson plan</strong> to a student. This generates a unique practice
            link you share with them (or their parent).
          </li>
          <li>
            Students open the link in any browser &mdash; no login required &mdash; and start
            practicing!
          </li>
        </ol>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Templates vs Student-Specific Lesson Plans</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Templates</h3>
            <p className="text-muted">
              Templates are reusable lesson plan blueprints. When you assign a template to a student,
              CogNote creates a <em>copy</em> of it as a student-specific lesson plan. Changes to the
              template afterwards won&apos;t affect already-assigned copies.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Student-Specific Lesson Plans</h3>
            <p className="text-muted">
              These are individual lesson plans tied to one student. You can edit them directly to
              fine-tune what that particular student is working on. Student-specific lesson plans can
              also be assigned &mdash; for example, if a student lost their link or you want to
              share the same custom lesson plan with a sibling.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Lesson Plan Types</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-medium">Note Identification</h3>
            <p className="text-muted">
              Students see a note on the staff and pick its name from multiple-choice answers.
              You can choose the clef, key signature, accidentals, and specific notes to include.
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
              A fixed number of questions (set in the lesson plan). Scores are recorded and visible on
              the student&apos;s detail page.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Free Practice</h3>
            <p className="text-muted">
              Unlimited questions &mdash; the student practices at their own pace and quits whenever
              they want.
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
              <strong>No clue 😵</strong> &bull;&nbsp;
              <strong>Tricky 😬</strong> &bull;&nbsp;
              <strong>Got it 😊</strong> &bull;&nbsp;
              <strong>Easy! 🤩</strong>
            </p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Student Notes &amp; Difficulty</h2>
        <p className="text-sm text-muted leading-relaxed">
          Each lesson plan can have a difficulty level (beginner / intermediate / advanced) and a
          teacher notes field for your own reminders. Students also have their own notes field
          on their detail page &mdash; great for tracking lesson observations, practice
          instructions, or anything you want to remember for that student.
        </p>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Sharing Practice Links</h2>
        <p className="text-sm text-muted leading-relaxed">
          When you assign a lesson plan, CogNote generates a short URL you can copy and text or email
          to a parent. The student opens it in any browser &mdash; no account needed. Each link
          is unique per student+lesson plan and stays active until you remove the assignment.
        </p>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-xl font-semibold">Tips</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted leading-relaxed">
          <li>
            Start simple &mdash; a 5-note Middle C position lesson plan with 10 questions per lesson is
            a great first assignment.
          </li>
          <li>
            Use flashcard mode for students who need extra drilling on specific notes.
          </li>
          <li>
            Check the student detail page to see per-note accuracy and session history.
          </li>
          <li>
            Edit a student-specific lesson plan anytime to add or remove notes as they progress.
          </li>
        </ul>
      </Card>
    </div>
  );
}
