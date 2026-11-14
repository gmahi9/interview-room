export const ROLE_IDS = [
  'software-engineer',
  'frontend',
  'backend',
  'data-engineer',
  'ml-engineer',
  'devops',
  'cybersecurity',
  'product-manager',
  'nurse',
  'medical-assistant',
  'electrician-apprentice',
  'sales-rep',
  'customer-service',
  'teacher',
  'behavioral',
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export const LEVELS = ['entry', 'mid', 'senior'] as const;
export type Level = (typeof LEVELS)[number];

export const CATEGORIES = ['behavioral', 'technical', 'situational'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Question {
  id: string;
  role: RoleId;
  levels: Level[];
  category: Category;
  text: string;
  lookFor: string;
  outline: string[];
  keyPoints: string[];
  targetSeconds: number;
}

export interface RoleInfo {
  id: RoleId;
  label: string;
  blurb: string;
  disclaimer?: string;
}

export interface PauseSpan {
  start: number;
  end: number;
  duration: number;
}

export interface FillerHit {
  word: string;
  count: number;
}

export interface KeywordHit {
  point: string;
  covered: boolean;
}

export interface StarFlags {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
  hits: number;
}

export type LengthLabel = 'short' | 'on-target' | 'long';
export type ScoreBand = 'Strong' | 'Solid' | 'Developing' | 'Early';
export type InputMode = 'speech' | 'typed';
export type SessionMode = 'practice' | 'mock';

export interface Analysis {
  wordCount: number;
  wordsPerMinute: number;
  fillers: FillerHit[];
  fillerCount: number;
  pauseCount: number;
  longestPauseSeconds: number;
  length: LengthLabel;
  star: StarFlags;
  keywords: KeywordHit[];
  coverageRatio: number;
  score: number;
  band: ScoreBand;
  headline: string;
  strengths: string[];
  tips: string[];
}

export interface AnalyzeInput {
  transcript: string;
  durationSeconds: number;
  pauses: PauseSpan[];
  keyPoints: string[];
  targetSeconds: number;
  category: Category;
  spoken: boolean;
}

export interface StoredAnswer {
  questionId: string;
  prompt: string;
  category: Category;
  lookFor: string;
  outline: string[];
  targetSeconds: number;
  transcript: string;
  durationSeconds: number;
  inputMode: InputMode;
  analysis: Analysis;
}

export interface Session {
  id: string;
  startedAt: string;
  completedAt: string;
  role: RoleId;
  level: Level;
  mode: SessionMode;
  answers: StoredAnswer[];
  averageScore: number;
}
