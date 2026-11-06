import { CODE_SECONDS, makeCode } from './codes.ts';
import { findArrival, matchScores, type Arrival } from './matchedFilter.ts';

export type Problem = 'no-door-sound' | 'no-holder-sound' | 'overlap' | 'dropout';

export interface Recording {
  samples: Float32Array;
  sampleRate: number;
  /** Frame ranges, [start, end), that the browser never delivered. */
  gaps: Array<[number, number]>;
}

export interface Analysis {
  door: Arrival | null;
  holder: Arrival | null;
  /** Seconds from the door's sound to the holder's sound on this phone's recording. */
  elapsedSeconds: number | null;
  problem: Problem | null;
  clippedFraction: number;
  doorScores: Float32Array;
  holderScores: Float32Array;
}

const CLIPPED_LEVEL = 0.99;
/** One browser audio block. A run of exact zeros this long is a lost block, not silence. */
const LOST_BLOCK_FRAMES = 128;
/** Extra span checked around the sounds, in seconds. */
const DROPOUT_MARGIN_SECONDS = 0.01;

function hasDropout(recording: Recording, start: number, end: number): boolean {
  const from = Math.max(0, start);
  const to = Math.min(recording.samples.length, end);
  if (recording.gaps.some(([gapStart, gapEnd]) => gapStart < to && gapEnd > from)) return true;

  let zeros = 0;
  for (let i = from; i < to; i++) {
    zeros = recording.samples[i] === 0 ? zeros + 1 : 0;
    if (zeros >= LOST_BLOCK_FRAMES) return true;
  }
  return false;
}

export function analyzeRecording(recording: Recording, seed: string): Analysis {
  const { samples, sampleRate } = recording;
  const doorScores = matchScores(samples, makeCode(seed, 'door', sampleRate));
  const holderScores = matchScores(samples, makeCode(seed, 'holder', sampleRate));
  const door = findArrival(doorScores, sampleRate);
  const holder = findArrival(holderScores, sampleRate);

  let clipped = 0;
  for (const sample of samples) if (Math.abs(sample) >= CLIPPED_LEVEL) clipped++;

  const base = {
    door,
    holder,
    elapsedSeconds: null,
    clippedFraction: clipped / Math.max(1, samples.length),
    doorScores,
    holderScores,
  };

  if (!door) return { ...base, problem: 'no-door-sound' };
  if (!holder) return { ...base, problem: 'no-holder-sound' };

  const codeFrames = Math.round(CODE_SECONDS * sampleRate);
  if (Math.abs(holder.frame - door.frame) < codeFrames) return { ...base, problem: 'overlap' };

  const margin = Math.round(DROPOUT_MARGIN_SECONDS * sampleRate);
  const spanStart = Math.min(door.frame, holder.frame) - margin;
  const spanEnd = Math.max(door.frame, holder.frame) + codeFrames + margin;
  if (hasDropout(recording, spanStart, spanEnd)) return { ...base, problem: 'dropout' };

  return { ...base, problem: null, elapsedSeconds: (holder.frame - door.frame) / sampleRate };
}
