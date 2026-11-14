import { describe, expect, it } from 'vitest';
import { QUESTION_BANK } from './bank';
import { ROLES } from './roles';
import { LEVELS } from '../types';
import { questionsFor } from '../lib/questions';

describe('question bank', () => {
  it('has at least 300 original questions', () => {
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(300);
  });

  it('covers every role and level with enough questions for a mock', () => {
    for (const role of ROLES) {
      for (const level of LEVELS) {
        const pool = questionsFor(QUESTION_BANK, role.id, level);
        expect(pool.length, `${role.id} ${level}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('includes behavioral, technical, and situational questions', () => {
    const categories = new Set(QUESTION_BANK.map((question) => question.category));
    expect(categories.has('behavioral')).toBe(true);
    expect(categories.has('technical')).toBe(true);
    expect(categories.has('situational')).toBe(true);
  });

  it('gives every question a unique id, a interviewer note, an outline, and key points', () => {
    const ids = new Set<string>();
    for (const question of QUESTION_BANK) {
      expect(ids.has(question.id), question.id).toBe(false);
      ids.add(question.id);
      expect(question.text.length).toBeGreaterThan(20);
      expect(question.lookFor.length).toBeGreaterThan(40);
      expect(question.outline.length).toBeGreaterThanOrEqual(3);
      expect(question.keyPoints.length).toBeGreaterThanOrEqual(3);
      expect(question.targetSeconds).toBeGreaterThanOrEqual(60);
      expect(question.targetSeconds).toBeLessThanOrEqual(180);
      for (const point of question.keyPoints) expect(point.length).toBeGreaterThan(1);
      for (const step of question.outline) expect(step.length).toBeGreaterThan(8);
    }
  });
});
