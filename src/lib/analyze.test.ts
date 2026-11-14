import { describe, expect, it } from 'vitest';
import { analyzeAnswer, cleanTranscript, countFillers, detectStar, keywordCoverage, wordsPerMinute } from './analyze';
import { detectPauses } from './pauses';
import { pickQuestions, questionsFor } from './questions';
import { addSession, deleteSession, loadSessions } from './storage';
import { formatClock } from './format';
import type { Question, Session } from '../types';

function tone(samples: Float32Array, start: number, end: number, amplitude = 0.2) {
  for (let i = start; i < end; i += 1) {
    samples[i] = amplitude * Math.sin(i / 8);
  }
}

describe('fillers', () => {
  it('counts um, uh, you know, and basically', () => {
    const hits = countFillers('Um, I think, uh, we should, you know, basically start');
    const map = Object.fromEntries(hits.map((hit) => [hit.word, hit.count]));
    expect(map.um).toBe(1);
    expect(map.uh).toBe(1);
    expect(map['you know']).toBe(1);
    expect(map.basically).toBe(1);
  });

  it('skips ordinary uses of like', () => {
    expect(countFillers('I would like to join the team').some((hit) => hit.word === 'like')).toBe(false);
    expect(countFillers('I like this design').some((hit) => hit.word === 'like')).toBe(false);
    expect(countFillers('It looks like a solid plan').some((hit) => hit.word === 'like')).toBe(false);
  });

  it('counts discourse like', () => {
    const hits = countFillers('I was like, so like, basically done, you know');
    const like = hits.find((hit) => hit.word === 'like');
    expect(like?.count).toBe(2);
  });

  it('does not treat error as a filler', () => {
    expect(countFillers('The error was in the parser').every((hit) => hit.word !== 'uh')).toBe(true);
  });
});

describe('pace and length', () => {
  it('computes words per minute', () => {
    expect(wordsPerMinute(130, 60)).toBe(130);
    expect(wordsPerMinute(0, 60)).toBe(0);
    expect(wordsPerMinute(40, 0)).toBe(0);
  });

  it('does not punish typing speed', () => {
    const fast = analyzeAnswer({
      transcript: 'I checked the logs then I fixed the query and the result was a faster page. '.repeat(12),
      durationSeconds: 20,
      pauses: [],
      keyPoints: ['logs', 'query'],
      targetSeconds: 90,
      category: 'technical',
      spoken: false,
    });
    const spoken = analyzeAnswer({
      ...{
        transcript: fast.wordCount > 0 ? 'I checked the logs then I fixed the query and the result was a faster page. '.repeat(12) : '',
        durationSeconds: 20,
        pauses: [],
        keyPoints: ['logs', 'query'],
        targetSeconds: 90,
        category: 'technical' as const,
        spoken: true,
      },
    });
    expect(spoken.wordsPerMinute).toBeGreaterThan(170);
    expect(spoken.score).toBeLessThan(fast.score);
  });
});

describe('STAR and keywords', () => {
  it('detects a full STAR story', () => {
    const star = detectStar(
      'When I was on the team, the project was late. I was responsible for the release. I decided to cut scope and I tested the path. As a result we shipped on Friday and I learned to name the risk earlier.',
    );
    expect(star.situation).toBe(true);
    expect(star.task).toBe(true);
    expect(star.action).toBe(true);
    expect(star.result).toBe(true);
    expect(star.hits).toBe(4);
  });

  it('misses situation and result when the answer is only actions', () => {
    const star = detectStar('I fixed the bug and I wrote a test.');
    expect(star.action).toBe(true);
    expect(star.situation).toBe(false);
    expect(star.result).toBe(false);
  });

  it('covers key phrases and ignores a missing one', () => {
    const hits = keywordCoverage('I added unit tests before the release.', ['unit tests', 'rollback plan']);
    expect(hits[0].covered).toBe(true);
    expect(hits[1].covered).toBe(false);
  });
});

describe('pauses', () => {
  it('finds a quiet gap and ignores a short one', () => {
    const rate = 16000;
    const samples = new Float32Array(rate * 3);
    tone(samples, 0, rate);
    tone(samples, rate * 2, rate * 3);
    const pauses = detectPauses(samples, rate);
    expect(pauses).toHaveLength(1);
    expect(pauses[0].duration).toBeGreaterThan(0.7);

    const brief = new Float32Array(rate);
    tone(brief, 0, Math.floor(rate * 0.4));
    tone(brief, Math.floor(rate * 0.6), rate);
    expect(detectPauses(brief, rate)).toHaveLength(0);
  });

  it('ignores silence at the ends', () => {
    const rate = 8000;
    const samples = new Float32Array(rate * 3);
    tone(samples, rate, rate * 2);
    expect(detectPauses(samples, rate)).toHaveLength(0);
  });
});

describe('scoring', () => {
  const story = 'When I was on the payments team last year, the project was missing a clear owner. I was responsible for the retry path. I sat down with support, I checked the logs, and I fixed the duplicate charges. As a result we cut repeats by 30 percent and I learned to write the alert first.';

  it('scores a specific story higher than a thin one', () => {
    const strong = analyzeAnswer({
      transcript: story,
      durationSeconds: 95,
      pauses: [{ start: 20, end: 21, duration: 1 }],
      keyPoints: ['owner', 'logs', 'duplicate', 'alert'],
      targetSeconds: 120,
      category: 'behavioral',
      spoken: true,
    });
    const thin = analyzeAnswer({
      transcript: 'I worked hard and did my best.',
      durationSeconds: 8,
      pauses: [],
      keyPoints: ['owner', 'logs', 'duplicate', 'alert'],
      targetSeconds: 120,
      category: 'behavioral',
      spoken: true,
    });
    expect(strong.score).toBeGreaterThan(thin.score);
    expect(strong.band === 'Strong' || strong.band === 'Solid').toBe(true);
    expect(thin.tips.length).toBeGreaterThan(0);
    expect(strong.headline.length).toBeGreaterThan(10);
  });

  it('names a concrete next step when fillers pile up', () => {
    const analysis = analyzeAnswer({
      transcript: `Um uh basically ${story} you know you know`,
      durationSeconds: 100,
      pauses: [],
      keyPoints: ['logs'],
      targetSeconds: 120,
      category: 'behavioral',
      spoken: true,
    });
    expect(analysis.tips.some((tip) => /um|basically|you know|pause/i.test(tip))).toBe(true);
  });

  it('clears known empty transcripts from a quiet recording', () => {
    expect(cleanTranscript('Thanks for watching.')).toBe('');
    expect(cleanTranscript('  We shipped the fix. ')).toBe('We shipped the fix.');
  });
});

describe('question picking and storage', () => {
  const bank: Question[] = [
    question('a', 'behavioral'),
    question('b', 'behavioral'),
    question('c', 'technical'),
    question('d', 'technical'),
    question('e', 'situational'),
    question('f', 'situational'),
    { ...question('other', 'behavioral'), role: 'teacher', id: 'other' },
  ];

  it('filters by role and level', () => {
    expect(questionsFor(bank, 'nurse', 'entry').map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(questionsFor(bank, 'nurse', 'senior')).toHaveLength(0);
  });

  it('mixes categories for a five question set', () => {
    const picked = pickQuestions(bank, 'nurse', 'entry', 5, () => 0.1);
    const categories = new Set(picked.map((item) => item.category));
    expect(picked).toHaveLength(5);
    expect(categories.has('behavioral')).toBe(true);
    expect(categories.has('technical')).toBe(true);
    expect(categories.has('situational')).toBe(true);
    expect(picked.every((item) => item.role === 'nurse')).toBe(true);
  });

  it('stores and deletes sessions', () => {
    const memory = new Map<string, string>();
    const store = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
    const session: Session = {
      id: 'one',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:10:00.000Z',
      role: 'teacher',
      level: 'mid',
      mode: 'mock',
      answers: [],
      averageScore: 80,
    };
    expect(loadSessions(store)).toEqual([]);
    addSession(store, session);
    expect(loadSessions(store)).toHaveLength(1);
    deleteSession(store, 'one');
    expect(loadSessions(store)).toEqual([]);
    store.setItem('ipr-sessions', '{');
    expect(loadSessions(store)).toEqual([]);
  });

  it('formats the clock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(75)).toBe('01:15');
  });
});

function question(id: string, category: Question['category']): Question {
  return {
    id,
    role: 'nurse',
    levels: ['entry'],
    category,
    text: `Question ${id}`,
    lookFor: 'A specific example with an outcome.',
    outline: ['Set the scene', 'Name your part', 'Describe the action', 'Close with the result'],
    keyPoints: ['example', 'outcome'],
    targetSeconds: 90,
  };
}
