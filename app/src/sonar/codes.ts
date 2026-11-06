import FFT from 'fft.js';

export type Role = 'door' | 'holder';

export const CODE_SECONDS = 0.25;
const LOW_HZ = 2000;
const HIGH_HZ = 18000;
const FADE_SECONDS = 0.005;
const TARGET_RMS = 0.2;
const MAX_PEAK = 0.95;

export function nextPowerOfTwo(value: number): number {
  let size = 2;
  while (size < value) size *= 2;
  return size;
}

function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Noise-like signal limited to 2–18 kHz. The same seed and role always give the same sound on
 * both phones, and a fresh seed means an old recording can't be replayed.
 */
export function makeCode(seed: string, role: Role, sampleRate: number): Float32Array {
  const length = Math.round(CODE_SECONDS * sampleRate);
  const size = nextPowerOfTwo(length);
  const fft = new FFT(size);
  const random = seededRandom(hashText(`${seed}:${role}`));

  const noise = new Float64Array(size * 2);
  for (let i = 0; i < size; i++) noise[i * 2] = random() * 2 - 1;

  const spectrum = new Float64Array(size * 2);
  fft.transform(spectrum, noise);
  for (let bin = 0; bin < size; bin++) {
    const hz = (Math.min(bin, size - bin) * sampleRate) / size;
    if (hz < LOW_HZ || hz > HIGH_HZ) {
      spectrum[bin * 2] = 0;
      spectrum[bin * 2 + 1] = 0;
    }
  }
  const filtered = new Float64Array(size * 2);
  fft.inverseTransform(filtered, spectrum);

  const code = new Float32Array(length);
  const fade = Math.round(FADE_SECONDS * sampleRate);
  let energy = 0;
  for (let i = 0; i < length; i++) {
    const ramp = Math.min(1, i / fade, (length - 1 - i) / fade);
    code[i] = filtered[i * 2] * ramp;
    energy += code[i] * code[i];
  }

  let gain = TARGET_RMS / Math.sqrt(energy / length);
  let peak = 0;
  for (const sample of code) peak = Math.max(peak, Math.abs(sample));
  gain = Math.min(gain, MAX_PEAK / peak);
  for (let i = 0; i < length; i++) code[i] *= gain;
  return code;
}
