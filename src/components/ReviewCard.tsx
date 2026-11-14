import type { Analysis, Category, InputMode } from '../types';
import { CATEGORY_LABELS } from '../data/roles';
import { formatClock } from '../lib/format';

export function ReviewCard({
  prompt,
  category,
  lookFor,
  outline,
  transcript,
  durationSeconds,
  inputMode,
  analysis,
  targetSeconds,
}: {
  prompt: string;
  category: Category;
  lookFor: string;
  outline: string[];
  transcript: string;
  durationSeconds: number;
  inputMode: InputMode;
  analysis: Analysis;
  targetSeconds: number;
}) {
  const covered = analysis.keywords.filter((item) => item.covered).length;
  return (
    <article className="sheet review">
      <p className="kicker">
        <span className="chip">{CATEGORY_LABELS[category]}</span>
        <span className={`band band-${analysis.band.toLowerCase()}`}>{analysis.band}</span>
        <span className="score-num">{analysis.score}</span>
      </p>
      <h2 className="prompt prompt-small">{prompt}</h2>
      <p className="headline">{analysis.headline}</p>
      {analysis.strengths.length > 0 && (
        <ul className="strength-list">
          {analysis.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className="metric-grid">
        <Metric
          label={inputMode === 'speech' ? 'Speaking pace' : 'Drafting pace'}
          value={analysis.wordsPerMinute > 0 ? `${analysis.wordsPerMinute} wpm` : 'n/a'}
          detail={`${analysis.wordCount} words in ${formatClock(durationSeconds)}`}
        />
        <Metric
          label="Filler phrases"
          value={String(analysis.fillerCount)}
          detail={
            analysis.fillers.length
              ? analysis.fillers.map((item) => `${item.word} ${item.count}`).join(', ')
              : 'None from the tracked list'
          }
        />
        <Metric
          label="Pauses"
          value={inputMode === 'speech' ? String(analysis.pauseCount) : 'n/a'}
          detail={
            inputMode === 'speech'
              ? analysis.longestPauseSeconds > 0
                ? `Longest quiet stretch ${analysis.longestPauseSeconds.toFixed(1)}s`
                : 'No long quiet stretch inside the answer'
              : 'Measured from a recording'
          }
        />
        <Metric
          label="Length"
          value={lengthCopy(analysis.length)}
          detail={`Usual window about ${formatClock(targetSeconds)}`}
        />
        <Metric
          label="STAR shape"
          value={`${analysis.star.hits} of 4`}
          detail={`Situation ${mark(analysis.star.situation)}, task ${mark(analysis.star.task)}, action ${mark(analysis.star.action)}, result ${mark(analysis.star.result)}`}
        />
        <Metric
          label="Key points"
          value={analysis.keywords.length ? `${covered} of ${analysis.keywords.length}` : 'n/a'}
          detail={analysis.keywords.map((item) => `${item.covered ? 'Covered' : 'Missing'}: ${item.point}`).join(' · ')}
        />
      </div>
      <section>
        <h3>Next pass</h3>
        <ol className="tips">
          {analysis.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
      </section>
      <section>
        <h3>What interviewers look for</h3>
        <p>{lookFor}</p>
      </section>
      <section>
        <h3>Model answer outline</h3>
        <ol>
          {outline.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section>
        <h3>Your answer</h3>
        <p className="transcript">{transcript}</p>
      </section>
    </article>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}

function mark(present: boolean): string {
  return present ? 'present' : 'add';
}

function lengthCopy(length: Analysis['length']): string {
  if (length === 'short') return 'Short';
  if (length === 'long') return 'Long';
  return 'On target';
}
