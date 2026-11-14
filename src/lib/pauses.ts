import type { PauseSpan } from '../types';

export interface PauseOptions {
  threshold?: number;
  minSeconds?: number;
  frameMs?: number;
}

/**
 * Find quiet stretches inside a mono recording.
 * Leading and trailing silence are left out so the countdown into the mic
 * and the moment after stopping do not count as pauses in the answer.
 */
export function detectPauses(
  samples: Float32Array,
  sampleRate: number,
  options: PauseOptions = {},
): PauseSpan[] {
  const threshold = options.threshold ?? 0.012;
  const minSeconds = options.minSeconds ?? 0.7;
  const frameMs = options.frameMs ?? 20;
  if (samples.length === 0 || sampleRate <= 0) return [];

  const frame = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const silent: boolean[] = [];
  for (let i = 0; i < samples.length; i += frame) {
    const end = Math.min(samples.length, i + frame);
    let sum = 0;
    for (let j = i; j < end; j += 1) sum += samples[j] * samples[j];
    const rms = Math.sqrt(sum / (end - i));
    silent.push(rms < threshold);
  }

  const pauses: PauseSpan[] = [];
  let startFrame: number | null = null;
  for (let i = 0; i <= silent.length; i += 1) {
    const isSilent = i < silent.length && silent[i];
    if (isSilent && startFrame === null) startFrame = i;
    if (!isSilent && startFrame !== null) {
      const start = (startFrame * frame) / sampleRate;
      const end = (i * frame) / sampleRate;
      const duration = end - start;
      if (duration + 1e-6 >= minSeconds) pauses.push({ start, end, duration });
      startFrame = null;
    }
  }

  const total = samples.length / sampleRate;
  return pauses.filter((pause, index) => {
    const leading = index === 0 && pause.start < 0.08;
    const trailing = index === pauses.length - 1 && total - pause.end < 0.08;
    return !leading && !trailing;
  });
}
