import { useEffect, useMemo, useState } from 'react';
import { PracticeScreen, type AttemptDraft } from './components/PracticeScreen';
import { ReviewCard } from './components/ReviewCard';
import { SetupScreen } from './components/SetupScreen';
import { QUESTION_BANK } from './data/bank';
import { LEVEL_LABELS, roleById } from './data/roles';
import { analyzeAnswer } from './lib/analyze';
import { createId, formatWhen } from './lib/format';
import { pickQuestions } from './lib/questions';
import { addSession, averageScore, deleteSession, loadSessions } from './lib/storage';
import type { Level, Question, RoleId, Session, SessionMode, StoredAnswer } from './types';

type Theme = 'light' | 'dark';

interface Run {
  id: string;
  startedAt: string;
  role: RoleId;
  level: Level;
  mode: SessionMode;
  questions: Question[];
  answers: StoredAnswer[];
}

interface Attempt extends AttemptDraft {
  analysis: ReturnType<typeof analyzeAnswer>;
}

type View =
  | { name: 'setup' }
  | { name: 'history' }
  | { name: 'practice'; run: Run; index: number }
  | { name: 'feedback'; run: Run; index: number; attempt: Attempt }
  | { name: 'report'; session: Session; note: string | null };

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('ipr-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* use the system theme */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readSessions(): Session[] {
  try {
    return loadSessions(localStorage);
  } catch {
    return [];
  }
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [role, setRole] = useState<RoleId>('software-engineer');
  const [level, setLevel] = useState<Level>('mid');
  const [mode, setMode] = useState<SessionMode>('practice');
  const [count, setCount] = useState(3);
  const [sessions, setSessions] = useState<Session[]>(readSessions);
  const [view, setView] = useState<View>({ name: 'setup' });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12110f' : '#efe6d6');
    try {
      localStorage.setItem('ipr-theme', theme);
    } catch {
      /* the theme still applies for this visit */
    }
  }, [theme]);

  const recent = useMemo(() => sessions, [sessions]);

  function remember(session: Session) {
    try {
      const next = addSession(localStorage, session);
      setSessions(next);
      return null;
    } catch {
      setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      return 'This browser did not keep the session. You can still print it from this page.';
    }
  }

  function finish(run: Run) {
    const session: Session = {
      id: run.id,
      startedAt: run.startedAt,
      completedAt: new Date().toISOString(),
      role: run.role,
      level: run.level,
      mode: run.mode,
      answers: run.answers,
      averageScore: averageScore(run.answers.map((answer) => answer.analysis.score)),
    };
    const note = remember(session);
    setView({ name: 'report', session, note });
  }

  function begin() {
    const questions = pickQuestions(QUESTION_BANK, role, level, mode === 'mock' ? 5 : count);
    if (questions.length === 0) return;
    setView({
      name: 'practice',
      index: 0,
      run: {
        id: createId(),
        startedAt: new Date().toISOString(),
        role,
        level,
        mode,
        questions,
        answers: [],
      },
    });
  }

  function submit(run: Run, index: number, draft: AttemptDraft) {
    const question = run.questions[index];
    const analysis = analyzeAnswer({
      transcript: draft.transcript,
      durationSeconds: draft.durationSeconds,
      pauses: draft.pauses,
      keyPoints: question.keyPoints,
      targetSeconds: question.targetSeconds,
      category: question.category,
      spoken: draft.inputMode === 'speech',
    });
    setView({ name: 'feedback', run, index, attempt: { ...draft, analysis } });
  }

  function keepAnswer(run: Run, index: number, attempt: Attempt) {
    const question = run.questions[index];
    const stored: StoredAnswer = {
      questionId: question.id,
      prompt: question.text,
      category: question.category,
      lookFor: question.lookFor,
      outline: question.outline,
      targetSeconds: question.targetSeconds,
      transcript: attempt.transcript,
      durationSeconds: attempt.durationSeconds,
      inputMode: attempt.inputMode,
      analysis: attempt.analysis,
    };
    const nextRun: Run = { ...run, answers: [...run.answers, stored] };
    if (index + 1 >= run.questions.length) finish(nextRun);
    else setView({ name: 'practice', run: nextRun, index: index + 1 });
  }

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="site-header no-print">
        <div className="brand">
          <Mark />
          <div>
            <p className="brand-name">Interview Practice Room</p>
            <p className="brand-tag">Speak the answer. Keep the recording here.</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="button button-quiet" onClick={() => setView({ name: 'history' })}>
            History
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </header>
      <main id="content" className="site-main">
        {view.name === 'setup' && (
          <SetupScreen
            role={role}
            level={level}
            mode={mode}
            count={count}
            recent={recent}
            onRole={setRole}
            onLevel={setLevel}
            onMode={setMode}
            onCount={setCount}
            onStart={begin}
            onHistory={() => setView({ name: 'history' })}
            onOpenRecent={(session) => setView({ name: 'report', session, note: null })}
          />
        )}
        {view.name === 'practice' && (
          <PracticeScreen
            role={roleById(view.run.role)}
            level={view.run.level}
            mode={view.run.mode}
            question={view.run.questions[view.index]}
            index={view.index}
            total={view.run.questions.length}
            quitLabel={view.run.answers.length > 0 ? 'End and save finished answers' : 'Leave session'}
            onSubmit={(draft) => submit(view.run, view.index, draft)}
            onQuit={() => {
              if (view.run.answers.length > 0) finish(view.run);
              else setView({ name: 'setup' });
            }}
          />
        )}
        {view.name === 'feedback' && (
          <div className="stack">
            <p className="kicker no-print">
              Feedback · Question {view.index + 1} of {view.run.questions.length}
            </p>
            <ReviewCard
              prompt={view.run.questions[view.index].text}
              category={view.run.questions[view.index].category}
              lookFor={view.run.questions[view.index].lookFor}
              outline={view.run.questions[view.index].outline}
              transcript={view.attempt.transcript}
              durationSeconds={view.attempt.durationSeconds}
              inputMode={view.attempt.inputMode}
              analysis={view.attempt.analysis}
              targetSeconds={view.run.questions[view.index].targetSeconds}
            />
            <details className="how no-print">
              <summary>How this score is built</summary>
              <p>
                The score looks at length against the usual window, filler phrases, STAR cues, and whether your words cover the question&apos;s key points. A recording also counts speaking pace and quiet stretches. A typed answer skips those two checks.
              </p>
            </details>
            <div className="action-row no-print">
              <button type="button" className="button button-primary" onClick={() => keepAnswer(view.run, view.index, view.attempt)}>
                {view.index + 1 >= view.run.questions.length ? 'Finish session' : 'Next question'}
              </button>
              <button type="button" className="button button-quiet" onClick={() => setView({ name: 'practice', run: view.run, index: view.index })}>
                Try this question again
              </button>
            </div>
          </div>
        )}
        {view.name === 'report' && (
          <Report
            session={view.session}
            note={view.note}
            onHome={() => setView({ name: 'setup' })}
            onHistory={() => setView({ name: 'history' })}
          />
        )}
        {view.name === 'history' && (
          <section className="stack">
            <div className="section-head">
              <h1>Session history</h1>
              <button type="button" className="button button-quiet" onClick={() => setView({ name: 'setup' })}>
                Back
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="lede">Finished sessions stay in this browser. Nothing is stored yet.</p>
            ) : (
              <ul className="session-list">
                {sessions.map((session) => (
                  <li key={session.id} className="history-card">
                    <button type="button" className="session-button" onClick={() => setView({ name: 'report', session, note: null })}>
                      <span>{roleById(session.role).label}</span>
                      <span>{LEVEL_LABELS[session.level]}</span>
                      <span>{session.mode === 'mock' ? 'Mock' : 'Practice'}</span>
                      <span>{session.answers.length} answers</span>
                      <span>Average {session.averageScore}</span>
                      <span>{formatWhen(session.completedAt)}</span>
                    </button>
                    {pendingDelete === session.id ? (
                      <div className="confirm-row">
                        <p>Delete this session from this browser?</p>
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            try {
                              setSessions(deleteSession(localStorage, session.id));
                            } catch {
                              setSessions((current) => current.filter((item) => item.id !== session.id));
                            }
                            setPendingDelete(null);
                          }}
                        >
                          Confirm delete
                        </button>
                        <button type="button" className="button button-quiet" onClick={() => setPendingDelete(null)}>
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="button button-quiet" onClick={() => setPendingDelete(session.id)}>
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer no-print">
        <a href="https://aiteksolutions.net">by AI TEK SOLUTIONS</a>
      </footer>
    </>
  );
}

function Report({
  session,
  note,
  onHome,
  onHistory,
}: {
  session: Session;
  note: string | null;
  onHome: () => void;
  onHistory: () => void;
}) {
  const role = roleById(session.role);
  const title = `Interview practice ${role.label} ${formatWhen(session.completedAt)}`;
  return (
    <div className="stack" id="print-area">
      <div className="section-head">
        <div>
          <p className="eyebrow">Session summary</p>
          <h1>{role.label}</h1>
          <p className="lede">
            {LEVEL_LABELS[session.level]} · {session.mode === 'mock' ? 'Mock interview' : 'Practice'} · {session.answers.length} answers · average {session.averageScore}
          </p>
        </div>
        <div className="action-row no-print">
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              const previous = document.title;
              document.title = title;
              window.print();
              window.setTimeout(() => {
                document.title = previous;
              }, 400);
            }}
          >
            Export summary (PDF or print)
          </button>
          <button type="button" className="button button-quiet" onClick={onHome}>Practice again</button>
          <button type="button" className="button button-quiet" onClick={onHistory}>History</button>
        </div>
      </div>
      {note && <p className="note">{note}</p>}
      <p className="print-brand">Interview Practice Room · by AI TEK SOLUTIONS · https://aiteksolutions.net</p>
      {session.answers.map((answer) => (
        <ReviewCard
          key={answer.questionId}
          prompt={answer.prompt}
          category={answer.category}
          lookFor={answer.lookFor}
          outline={answer.outline}
          transcript={answer.transcript}
          durationSeconds={answer.durationSeconds}
          inputMode={answer.inputMode}
          analysis={answer.analysis}
          targetSeconds={answer.targetSeconds}
        />
      ))}
    </div>
  );
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="6" width="24" height="36" rx="2" />
      <path d="M28 16h12l-6 8 6 8H28z" />
    </svg>
  );
}
