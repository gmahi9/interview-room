import type {
  Analysis,
  AnalyzeInput,
  Category,
  FillerHit,
  KeywordHit,
  LengthLabel,
  ScoreBand,
  StarFlags,
} from '../types';

const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'with', 'your',
  'you', 'how', 'what', 'that', 'this', 'is', 'are', 'was', 'were', 'be', 'it',
  'as', 'at', 'by', 'from', 'into', 'about', 'we', 'i', 'they', 'our', 'my',
  'their', 'do', 'did', 'does', 'a', 'if', 'so', 'but', 'not', 'can', 'just',
]);

const LIKE_PREV_SKIP = new Set([
  'would', 'looks', 'look', 'seem', 'seems', 'seemed', 'sound', 'sounds',
  'sounded', 'felt', 'feel', 'feels', 'something', 'anything', 'nothing',
]);

const LIKE_SUBJECT = new Set(['i', 'we', 'they', 'you', 'people']);

const LIKE_DISCOURSE = new Set([
  'so', 'and', 'but', 'just', 'was', 'were', 'is', 'kinda', 'sorta', 'really',
  'then', 'because', 'yeah', 'well', 'oh', 'um', 'uh', 'uhm', 'like',
]);

const STAR_CUES: Record<keyof Omit<StarFlags, 'hits'>, RegExp[]> = {
  situation: [
    /\bsituation\b/,
    /\bcontext\b/,
    /\bbackground\b/,
    /\bat the time\b/,
    /\bthere was\b/,
    /\bwe were\b/,
    /\bwhen i\b/,
    /\bwhile i was\b/,
    /\bin my (last |previous |current )?(role|job|team)\b/,
    /\bthe team was\b/,
    /\bwe faced\b/,
    /\bthe problem was\b/,
    /\ba time when\b/,
    /\blast (year|quarter|month|spring|summer|fall|winter)\b/,
    /\bthe project was\b/,
    /\bonce when\b/,
  ],
  task: [
    /\bmy (task|role|responsibility|job) was\b/,
    /\bi was responsible\b/,
    /\bi needed to\b/,
    /\bi had to\b/,
    /\bthe goal\b/,
    /\bmy goal\b/,
    /\bi was asked\b/,
    /\bthe objective\b/,
    /\btasked with\b/,
    /\bmy part was\b/,
    /\bi owned\b/,
    /\bwe needed to\b/,
    /\bi was expected\b/,
    /\bthe aim\b/,
  ],
  action: [
    /\bi (decided|built|wrote|led|created|implemented|designed|talked|asked|organized|tested|fixed|proposed|started|reached|called|documented|paired|reviewed|shipped|measured|migrated|refactored|scheduled|trained|coached|escalated|listened|negotiated|prioritized|checked|explained|walked|gathered|compared|removed|added|updated|met|told|showed|shared|paused|verified|narrowed)\b/,
    /\bmy approach\b/,
    /\bwhat i did\b/,
    /\bi took\b/,
    /\bfirst,? i\b/,
    /\bthen i\b/,
    /\bi worked with\b/,
    /\bi set up\b/,
    /\bi put together\b/,
    /\bi sat down\b/,
  ],
  result: [
    /\bas a result\b/,
    /\bthe result\b/,
    /\bthe outcome\b/,
    /\bwhich led\b/,
    /\bwe (shipped|reduced|increased|improved|saved|launched|resolved|cut|grew|finished|caught)\b/,
    /\bin the end\b/,
    /\bultimately\b/,
    /\bthe impact\b/,
    /\bi learned\b/,
    /\bthe lesson\b/,
    /\bbecause of that\b/,
    /\b\d+\s?%/,
    /\bwent from\b/,
    /\bafter that\b/,
    /\bit worked\b/,
  ],
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'%+\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function countWords(text: string): number {
  return tokenize(text).length;
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function countFillers(text: string): FillerHit[] {
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  const um = countMatches(lower, /\b(um+|uhm+|umm+)\b/g);
  const uh = countMatches(lower, /\b(uh+|er+|ah+)\b/g);
  const youKnow = countMatches(lower, /\byou know\b/g);
  const basically = countMatches(lower, /\bbasically\b/g);
  const tokens = tokenize(lower);
  let like = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] !== 'like') continue;
    const prev = tokens[i - 1] ?? '';
    const next = tokens[i + 1] ?? '';
    if (next === 'to') continue;
    if (LIKE_PREV_SKIP.has(prev)) continue;
    if (LIKE_SUBJECT.has(prev)) continue;
    if (i === 0 || LIKE_DISCOURSE.has(prev)) like += 1;
  }
  return [
    { word: 'um', count: um },
    { word: 'uh', count: uh },
    { word: 'like', count: like },
    { word: 'you know', count: youKnow },
    { word: 'basically', count: basically },
  ].filter((hit) => hit.count > 0);
}

export function wordsPerMinute(wordCount: number, durationSeconds: number): number {
  if (wordCount <= 0 || durationSeconds <= 0) return 0;
  return Math.round(wordCount / (durationSeconds / 60));
}

export function lengthLabel(durationSeconds: number, targetSeconds: number, wordCount: number): LengthLabel {
  const target = targetSeconds > 0 ? targetSeconds : 90;
  const expectedWords = (target / 60) * 130;
  const durationRatio = durationSeconds > 0 ? durationSeconds / target : wordCount / Math.max(expectedWords, 1);
  const wordRatio = wordCount / Math.max(expectedWords, 1);
  const ratio = durationSeconds > 0 ? Math.max(durationRatio, wordRatio * 0.85) : wordRatio;
  if (ratio < 0.55) return 'short';
  if (ratio > 1.55) return 'long';
  return 'on-target';
}

function normalizeToken(word: string): string {
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function keywordCoverage(transcript: string, keyPoints: string[]): KeywordHit[] {
  const tokens = new Set(tokenize(transcript).map(normalizeToken));
  return keyPoints.map((point) => {
    const words = tokenize(point)
      .map(normalizeToken)
      .filter((word) => !STOP.has(word) && word.length > 1);
    if (words.length === 0) return { point, covered: false };
    const hits = words.filter((word) => tokens.has(word)).length;
    const needed = words.length === 1 ? 1 : Math.ceil(words.length * 0.6);
    return { point, covered: hits >= needed };
  });
}

export function detectStar(transcript: string): StarFlags {
  const text = transcript.toLowerCase();
  const situation = STAR_CUES.situation.some((cue) => cue.test(text));
  const task = STAR_CUES.task.some((cue) => cue.test(text));
  const action = STAR_CUES.action.some((cue) => cue.test(text));
  const result = STAR_CUES.result.some((cue) => cue.test(text));
  const hits = [situation, task, action, result].filter(Boolean).length;
  return { situation, task, action, result, hits };
}

function bandFor(score: number): ScoreBand {
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Solid';
  if (score >= 55) return 'Developing';
  return 'Early';
}

function missingStarLabel(star: StarFlags): string | null {
  if (!star.result) return 'a result: one sentence on what changed after your action';
  if (!star.situation) return 'a situation: where you were and what was going on';
  if (!star.action) return 'the action: the specific steps you took, in order';
  if (!star.task) return 'the task: what you personally were responsible for';
  return null;
}

function buildTips(input: AnalyzeInput, analysis: Omit<Analysis, 'tips' | 'headline' | 'strengths' | 'band' | 'score'> & { score: number }): string[] {
  const tips: string[] = [];
  const { spoken, category } = input;
  if (analysis.wordCount < 25) {
    tips.push('Add one concrete example: a person, a number, or a decision you made. Short answers are hard to trust.');
  }
  if (analysis.length === 'short' && analysis.wordCount >= 25) {
    tips.push('Stay a little longer. Add the outcome, or the tradeoff you considered, before you stop.');
  }
  if (analysis.length === 'long') {
    tips.push('Close sooner. Lead with the decision or the result, then give one supporting example.');
  }
  if (spoken && input.durationSeconds >= 20) {
    if (analysis.wordsPerMinute > 0 && analysis.wordsPerMinute < 95) {
      tips.push('Your pace is on the slow side for an interview. Aim near 130 words per minute and keep the detail.');
    } else if (analysis.wordsPerMinute > 185) {
      tips.push('You covered a lot quickly. Leave a short pause between the main points so a listener can follow.');
    }
  }
  if (analysis.fillerCount > 0) {
    const top = [...analysis.fillers].sort((a, b) => b.count - a.count)[0];
    if (top.word === 'like') {
      tips.push(`“Like” showed up ${top.count} time${top.count === 1 ? '' : 's'} in filler position. Swap the next one for the specific thing you mean. Ordinary uses such as “I like” are not counted.`);
    } else if (top.word === 'basically') {
      tips.push('Replace “basically” with the actual detail. Interviewers lean in when the sentence gets specific.');
    } else if (top.word === 'you know') {
      tips.push('Drop “you know” and finish the sentence. The idea is stronger without the check-in.');
    } else {
      tips.push(`You used “${top.word}” ${top.count} time${top.count === 1 ? '' : 's'}. Pause instead. Silence reads as thought; the filler reads as rush.`);
    }
  }
  if (spoken && analysis.longestPauseSeconds >= 2.5 && analysis.pauseCount >= 2) {
    tips.push('A couple of long silences broke the answer. If you need a moment, say “The part I want to get right is…” and then continue.');
  }
  if (category !== 'technical') {
    const missing = missingStarLabel(analysis.star);
    if (missing && analysis.star.hits < 4) {
      tips.push(`Add ${missing}.`);
    }
  } else if (!analysis.star.action || !analysis.star.result) {
    tips.push('For a technical answer, name the step you took and how you would know it worked.');
  }
  const missed = analysis.keywords.filter((item) => !item.covered).map((item) => item.point);
  if (missed.length > 0 && analysis.wordCount >= 12) {
    const shown = missed.slice(0, 3).join(', ');
    tips.push(`This question is listening for: ${shown}. Work one of those into the next take.`);
  }
  if (tips.length === 0) {
    tips.push('Keep this shape. Next time, try the same opening on a harder question in this role.');
  }
  return tips.slice(0, 4);
}

function buildStrengths(analysis: Omit<Analysis, 'strengths' | 'tips' | 'headline' | 'band'>, spoken: boolean, category: Category): string[] {
  const strengths: string[] = [];
  if (analysis.star.hits >= 3 && category !== 'technical') {
    strengths.push('Most of a STAR story is already in the answer.');
  }
  if (analysis.star.action && category === 'technical') {
    strengths.push('You named what you would actually do.');
  }
  if (analysis.coverageRatio >= 0.75 && analysis.keywords.length > 0) {
    strengths.push('You touched the points this question is built around.');
  }
  if (analysis.fillerCount === 0 && analysis.wordCount >= 40) {
    strengths.push('The wording stayed clean. None of the tracked filler phrases showed up.');
  }
  if (spoken && analysis.wordsPerMinute >= 110 && analysis.wordsPerMinute <= 165 && analysis.wordCount >= 40) {
    strengths.push('The pace sits in a comfortable listening range.');
  }
  if (analysis.length === 'on-target' && analysis.wordCount >= 40) {
    strengths.push('The length matches the usual window for this question.');
  }
  return strengths.slice(0, 3);
}

function headlineFor(score: number, strengths: string[], wordCount: number): string {
  if (wordCount < 12) {
    return 'You started. Add a specific example and an outcome, then run it again.';
  }
  if (score >= 85) {
    return strengths[0] ?? 'This answer is clear and complete.';
  }
  if (score >= 70) {
    return strengths[0] ?? 'The shape is there. A few concrete edits will make it land.';
  }
  if (score >= 55) {
    return 'There is a real answer here. The notes below are the next pass.';
  }
  return 'The next take only needs one story with a clear ending. You can build that.';
}

function starWeight(category: Category, star: StarFlags): number {
  if (category === 'technical') {
    let penalty = 0;
    if (!star.action) penalty += 6;
    if (!star.result) penalty += 6;
    return penalty;
  }
  return (4 - star.hits) * 6;
}

export function scoreAnswer(input: AnalyzeInput, partial: {
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  length: LengthLabel;
  star: StarFlags;
  coverageRatio: number;
  pauseCount: number;
  longestPauseSeconds: number;
}): number {
  if (partial.wordCount < 8) return Math.min(28, 8 + partial.wordCount);
  let score = 100;
  if (partial.wordCount < 25) score -= 12;
  if (partial.length === 'short') score -= 10;
  if (partial.length === 'long') score -= 8;
  if (input.spoken && input.durationSeconds >= 20) {
    if (partial.wordsPerMinute > 0 && partial.wordsPerMinute < 90) score -= 6;
    else if (partial.wordsPerMinute > 190) score -= 8;
    else if (partial.wordsPerMinute > 170) score -= 4;
  }
  const fillerRate = (partial.fillerCount / Math.max(partial.wordCount, 1)) * 100;
  if (fillerRate > 8) score -= 14;
  else if (fillerRate > 4) score -= 8;
  else if (fillerRate > 2) score -= 3;
  if (input.spoken) {
    const longPauses = input.pauses.filter((pause) => pause.duration >= 2.5).length;
    if (longPauses >= 3) score -= 8;
    else if (longPauses === 2) score -= 4;
  }
  score -= starWeight(input.category, partial.star);
  score -= Math.round((1 - partial.coverageRatio) * 18);
  if (partial.wordCount < 15) score = Math.min(score, 42);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeAnswer(input: AnalyzeInput): Analysis {
  const transcript = input.transcript.replace(/\s+/g, ' ').trim();
  const wordCount = countWords(transcript);
  const wpm = wordsPerMinute(wordCount, input.durationSeconds);
  const fillers = countFillers(transcript);
  const fillerCount = fillers.reduce((sum, hit) => sum + hit.count, 0);
  const star = detectStar(transcript);
  const keywords = keywordCoverage(transcript, input.keyPoints);
  const covered = keywords.filter((item) => item.covered).length;
  const coverageRatio = keywords.length === 0 ? 0 : covered / keywords.length;
  const length = lengthLabel(input.durationSeconds, input.targetSeconds, wordCount);
  const pauseCount = input.pauses.length;
  const longestPauseSeconds = input.pauses.reduce((max, pause) => Math.max(max, pause.duration), 0);
  const score = scoreAnswer(input, {
    wordCount,
    wordsPerMinute: wpm,
    fillerCount,
    length,
    star,
    coverageRatio,
    pauseCount,
    longestPauseSeconds,
  });
  const draft = {
    wordCount,
    wordsPerMinute: wpm,
    fillers,
    fillerCount,
    pauseCount,
    longestPauseSeconds: Math.round(longestPauseSeconds * 10) / 10,
    length,
    star,
    keywords,
    coverageRatio,
    score,
  };
  const strengths = buildStrengths(draft, input.spoken, input.category);
  const tips = buildTips(input, draft);
  return {
    ...draft,
    band: bandFor(score),
    headline: headlineFor(score, strengths, wordCount),
    strengths,
    tips,
  };
}

export function cleanTranscript(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const lower = trimmed.toLowerCase().replace(/[.!?]/g, '').trim();
  const junk = new Set([
    'thanks for watching',
    'thank you',
    'thank you for watching',
    'you',
    'subtitles by the amara org community',
    'blank_audio',
    '[blank_audio]',
    'silence',
  ]);
  if (junk.has(lower)) return '';
  return trimmed;
}
