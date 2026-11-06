import FFT from 'fft.js';
import { nextPowerOfTwo } from './codes.ts';

/**
 * A real arrival must beat this score. In simulations a wrong code peaked at about 0.05, and the
 * right code still scored 0.14 when 17 dB below white noise. Tune this using the lab's readings.
 */
const MIN_SCORE = 0.08;
/** A real arrival must also stand this far above the typical score in the recording. */
const NOISE_MULTIPLE = 6;
/** The direct sound arrives first, and reflections can be stronger, so look back this far. */
const LOOKBACK_SECONDS = 0.01;
const STRONG_FRACTION = 0.5;

export interface Arrival {
  frame: number;
  score: number;
}

/**
 * Slides the code across the recording. Each score is between 0 and 1, where 1 is a perfect
 * match, so a quiet partner can be found in the same recording as a phone's own loud sound.
 */
export function matchScores(recording: Float32Array, code: Float32Array): Float32Array {
  const positions = recording.length - code.length + 1;
  if (positions <= 0) return new Float32Array(0);

  const size = nextPowerOfTwo(recording.length + code.length);
  const fft = new FFT(size);
  const transformed = (signal: Float32Array) => {
    const input = new Float64Array(size * 2);
    for (let i = 0; i < signal.length; i++) input[i * 2] = signal[i];
    const output = new Float64Array(size * 2);
    fft.transform(output, input);
    return output;
  };

  const recordingSpectrum = transformed(recording);
  const codeSpectrum = transformed(code);
  const product = new Float64Array(size * 2);
  for (let i = 0; i < size; i++) {
    const a = recordingSpectrum[i * 2];
    const b = recordingSpectrum[i * 2 + 1];
    const c = codeSpectrum[i * 2];
    const d = codeSpectrum[i * 2 + 1];
    product[i * 2] = a * c + b * d;
    product[i * 2 + 1] = b * c - a * d;
  }
  const correlation = new Float64Array(size * 2);
  fft.inverseTransform(correlation, product);

  let codeEnergy = 0;
  for (const sample of code) codeEnergy += sample * sample;

  const energyBefore = new Float64Array(recording.length + 1);
  for (let i = 0; i < recording.length; i++) {
    energyBefore[i + 1] = energyBefore[i] + recording[i] * recording[i];
  }

  const scores = new Float32Array(positions);
  const silence = 1e-9 * code.length;
  for (let k = 0; k < positions; k++) {
    const windowEnergy = energyBefore[k + code.length] - energyBefore[k];
    scores[k] = Math.abs(correlation[k * 2]) / Math.sqrt(codeEnergy * Math.max(windowEnergy, silence));
  }
  return scores;
}

function typicalScore(scores: Float32Array): number {
  const sampled: number[] = [];
  for (let i = 0; i < scores.length; i += 32) sampled.push(scores[i]);
  sampled.sort((a, b) => a - b);
  return sampled[Math.floor(sampled.length / 2)] ?? 0;
}

/** Finds where a code first arrives, or null if nothing stands out from the noise. */
export function findArrival(scores: Float32Array, sampleRate: number): Arrival | null {
  let strongest = -1;
  let strongestScore = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > strongestScore) {
      strongestScore = scores[i];
      strongest = i;
    }
  }
  if (strongest < 0) return null;
  if (strongestScore < Math.max(MIN_SCORE, NOISE_MULTIPLE * typicalScore(scores))) return null;

  const earliest = Math.max(1, strongest - Math.round(LOOKBACK_SECONDS * sampleRate));
  const strongEnough = strongestScore * STRONG_FRACTION;
  for (let i = earliest; i < strongest; i++) {
    if (scores[i] >= strongEnough && scores[i] >= scores[i - 1] && scores[i] >= scores[i + 1]) {
      return { frame: i, score: scores[i] };
    }
  }
  return { frame: strongest, score: strongestScore };
}
