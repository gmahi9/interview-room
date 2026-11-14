import { LEVELS, type Level, type RoleId, type Session, type SessionMode } from '../types';
import { LEVEL_LABELS, ROLES, roleById } from '../data/roles';
import { formatWhen } from '../lib/format';

export function SetupScreen({
  role,
  level,
  mode,
  count,
  recent,
  onRole,
  onLevel,
  onMode,
  onCount,
  onStart,
  onHistory,
  onOpenRecent,
}: {
  role: RoleId;
  level: Level;
  mode: SessionMode;
  count: number;
  recent: Session[];
  onRole: (role: RoleId) => void;
  onLevel: (level: Level) => void;
  onMode: (mode: SessionMode) => void;
  onCount: (count: number) => void;
  onStart: () => void;
  onHistory: () => void;
  onOpenRecent: (session: Session) => void;
}) {
  const selected = roleById(role);
  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">Private practice</p>
        <h1>Interview Practice Room</h1>
        <p className="lede">
          Choose a role, answer out loud or in writing, and get a clear read on pace, structure, and the points the question is listening for. Audio stays on this device.
        </p>
      </section>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          onStart();
        }}
      >
        <fieldset>
          <legend>Role</legend>
          <div className="role-grid">
            {ROLES.map((item) => (
              <label key={item.id} className={item.id === role ? 'choice is-selected' : 'choice'}>
                <input
                  type="radio"
                  name="role"
                  value={item.id}
                  checked={item.id === role}
                  onChange={() => onRole(item.id)}
                />
                <span className="choice-title">{item.label}</span>
                <span className="choice-blurb">{item.blurb}</span>
              </label>
            ))}
          </div>
          {selected.disclaimer && <p className="note">{selected.disclaimer}</p>}
        </fieldset>

        <fieldset>
          <legend>Level</legend>
          <div className="segment" role="presentation">
            {LEVELS.map((item) => (
              <label key={item} className={item === level ? 'segment-item is-selected' : 'segment-item'}>
                <input
                  type="radio"
                  name="level"
                  value={item}
                  checked={item === level}
                  onChange={() => onLevel(item)}
                />
                {LEVEL_LABELS[item]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Session</legend>
          <div className="segment">
            <label className={mode === 'practice' ? 'segment-item is-selected' : 'segment-item'}>
              <input type="radio" name="mode" value="practice" checked={mode === 'practice'} onChange={() => onMode('practice')} />
              Practice set
            </label>
            <label className={mode === 'mock' ? 'segment-item is-selected' : 'segment-item'}>
              <input type="radio" name="mode" value="mock" checked={mode === 'mock'} onChange={() => onMode('mock')} />
              Mock interview, 5 questions
            </label>
          </div>
          {mode === 'practice' && (
            <div className="segment segment-sub">
              {[1, 3, 5].map((value) => (
                <label key={value} className={count === value ? 'segment-item is-selected' : 'segment-item'}>
                  <input
                    type="radio"
                    name="count"
                    value={value}
                    checked={count === value}
                    onChange={() => onCount(value)}
                  />
                  {value === 1 ? '1 question' : `${value} questions`}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="action-row">
          <button type="submit" className="button button-primary">
            Begin
          </button>
          <button type="button" className="button button-quiet" onClick={onHistory}>
            Session history
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <section>
          <h2>Recent sessions</h2>
          <ul className="session-list">
            {recent.slice(0, 3).map((session) => (
              <li key={session.id}>
                <button type="button" className="session-button" onClick={() => onOpenRecent(session)}>
                  <span>{roleById(session.role).label}</span>
                  <span>{LEVEL_LABELS[session.level]}</span>
                  <span>{session.averageScore}</span>
                  <span>{formatWhen(session.completedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
