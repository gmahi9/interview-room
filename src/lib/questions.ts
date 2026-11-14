import type { Level, Question, RoleId } from '../types';

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}

export function questionsFor(questions: readonly Question[], role: RoleId, level: Level): Question[] {
  return questions.filter((question) => question.role === role && question.levels.includes(level));
}

/**
 * Pick a practice set. When count is at least 3, keep a mix of behavioral,
 * technical, and situational questions whenever the pool has them.
 */
export function pickQuestions(
  questions: readonly Question[],
  role: RoleId,
  level: Level,
  count: number,
  rng: () => number = Math.random,
): Question[] {
  const pool = questionsFor(questions, role, level);
  if (count <= 0 || pool.length === 0) return [];
  if (count < 3 || pool.length <= count) return shuffle(pool, rng).slice(0, Math.min(count, pool.length));

  const groups: Record<Question['category'], Question[]> = {
    behavioral: [],
    technical: [],
    situational: [],
  };
  for (const question of pool) groups[question.category].push(question);

  const available = (Object.keys(groups) as Question['category'][]).filter((key) => groups[key].length > 0);
  const quotas = new Map<Question['category'], number>();
  if (available.length === 1) {
    quotas.set(available[0], count);
  } else {
    const situational = available.includes('situational') ? 1 : 0;
    const rest = count - situational;
    const share = Math.floor(rest / Math.max(available.filter((key) => key !== 'situational').length, 1));
    for (const key of available) {
      if (key === 'situational') quotas.set(key, situational);
      else quotas.set(key, share);
    }
    let assigned = [...quotas.values()].reduce((sum, value) => sum + value, 0);
    for (const key of available) {
      if (assigned >= count) break;
      quotas.set(key, (quotas.get(key) ?? 0) + 1);
      assigned += 1;
    }
  }

  const chosen: Question[] = [];
  const leftovers: Question[] = [];
  for (const key of available) {
    const shuffled = shuffle(groups[key], rng);
    const take = Math.min(quotas.get(key) ?? 0, shuffled.length);
    chosen.push(...shuffled.slice(0, take));
    leftovers.push(...shuffled.slice(take));
  }
  if (chosen.length < count) {
    chosen.push(...shuffle(leftovers, rng).slice(0, count - chosen.length));
  }
  return shuffle(chosen, rng).slice(0, Math.min(count, chosen.length));
}
