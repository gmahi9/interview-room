import type { Category, Level, Question, RoleId } from '../types';

export const ALL: Level[] = ['entry', 'mid', 'senior'];
export const ENTRY: Level[] = ['entry'];
export const MID: Level[] = ['mid'];
export const SENIOR: Level[] = ['senior'];

export function q(
  id: string,
  role: RoleId,
  levels: Level[],
  category: Category,
  targetSeconds: number,
  text: string,
  lookFor: string,
  outline: string[],
  keyPoints: string[],
): Question {
  return { id, role, levels, category, targetSeconds, text, lookFor, outline, keyPoints };
}
