import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeRecording, type Recording } from '../src/sonar/analyze.ts';
import { CODE_SECONDS, makeCode } from '../src/sonar/codes.ts';
import { distanceCm, verdictFor } from '../src/sonar/distance.ts';

const SAMPLE_RATE = 48000;
const SPEED_CM_S = 34300;
const SEED = 'test-seed';
const RECORD_SECONDS = 6;

function quietNoise(level: number, seedValue: number): Float32Array {
  const samples = new Float32Array(RECORD_SECONDS * SAMPLE_RATE);
  let state = seedValue;
  for (let i = 0; i < samples.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    samples[i] = ((state / 4294967296) * 2 - 1) * level;
  }
  return samples;
}

function mix(samples: Float32Array, code: Float32Array, atSeconds: number, gain: number) {
  const start = Math.round(atSeconds * SAMPLE_RATE);
  for (let i = 0; i < code.length; i++) samples[start + i] += code[i] * gain;
}

interface Scene {
  distanceCm: number;
  relayUpSeconds?: number;
  relayDownSeconds?: number;
  partnerGain?: number;
  noise?: number;
  reflection?: boolean;
  /** Speaker-to-mic spacing on each phone. */
  selfCm?: number;
}

/** Builds what each phone's mic would hear, with unrelated software delay on each phone. */
function simulate(scene: Scene): { door: Recording; holder: Recording } {
  const doorCode = makeCode(SEED, 'door', SAMPLE_RATE);
  const holderCode = makeCode(SEED, 'holder', SAMPLE_RATE);
  const travel = scene.distanceCm / SPEED_CM_S;
  const self = (scene.selfCm ?? 0) / SPEED_CM_S;
  const up = scene.relayUpSeconds ?? 0;
  const down = scene.relayDownSeconds ?? 0;
  const partnerGain = scene.partnerGain ?? 0.2;
  const noise = scene.noise ?? 0.001;

  // Recording clocks and speaker delays deliberately differ between the phones.
  const doorPlays = 1.537;
  const holderPlays = 3.214;
  const holderClockAhead = 0.313;

  const doorSamples = quietNoise(noise, 11);
  mix(doorSamples, doorCode, doorPlays + self, 0.8);
  mix(doorSamples, holderCode, holderPlays + travel + down, partnerGain);

  const holderSamples = quietNoise(noise, 29);
  mix(holderSamples, doorCode, doorPlays + travel + up - holderClockAhead, partnerGain);
  mix(holderSamples, holderCode, holderPlays + self - holderClockAhead, 0.8);

  if (scene.reflection) {
    mix(doorSamples, holderCode, holderPlays + travel + 0.004, partnerGain * 1.4);
    mix(holderSamples, doorCode, doorPlays + travel + 0.004 - holderClockAhead, partnerGain * 1.4);
  }

  return {
    door: { samples: doorSamples, sampleRate: SAMPLE_RATE, gaps: [] },
    holder: { samples: holderSamples, sampleRate: SAMPLE_RATE, gaps: [] },
  };
}

function measure(scene: Scene): number {
  const { door, holder } = simulate(scene);
  const doorResult = analyzeRecording(door, SEED);
  const holderResult = analyzeRecording(holder, SEED);
  assert.equal(doorResult.problem, null);
  assert.equal(holderResult.problem, null);
  return distanceCm(doorResult.elapsedSeconds!, holderResult.elapsedSeconds!);
}

function assertWithin(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

function recordingOf(samples: Float32Array): Recording {
  return { samples, sampleRate: SAMPLE_RATE, gaps: [] };
}

describe('distance between two phones', () => {
  for (const cm of [10, 30, 59, 100, 200, 300]) {
    it(`measures ${cm} cm to within 2 cm`, () => assertWithin(measure({ distanceCm: cm }), cm, 2));
  }

  it('reads short by the speaker-to-mic spacing, as the formula predicts', () => {
    assertWithin(measure({ distanceCm: 30, selfCm: 12 }), 18, 2);
  });

  it('finds a partner 30 dB quieter than the phone itself', () => {
    assertWithin(measure({ distanceCm: 30, partnerGain: 0.8 * 10 ** (-30 / 20) }), 30, 2);
  });

  it('holds up in loud background noise', () => {
    assertWithin(measure({ distanceCm: 30, noise: 0.2 }), 30, 2);
  });

  it('uses the first arrival when a reflection is stronger', () => {
    assertWithin(measure({ distanceCm: 30, reflection: true }), 30, 2);
  });
});

describe('relayed sound', () => {
  it('reads about 34 m with a 200 ms round trip', () => {
    const cm = measure({ distanceCm: 5, relayUpSeconds: 0.1, relayDownSeconds: 0.1 });
    assertWithin(cm, 3435, 5);
    assert.equal(verdictFor(cm), 'far');
  });

  it('fails with only 5 ms of added delay', () => {
    const cm = measure({ distanceCm: 5, relayUpSeconds: 0.0025, relayDownSeconds: 0.0025 });
    assert.equal(verdictFor(cm), 'far');
  });
});

describe('bad recordings are not measured', () => {
  it('reports a missing partner', () => {
    const samples = quietNoise(0.001, 3);
    mix(samples, makeCode(SEED, 'door', SAMPLE_RATE), 1.5, 0.8);
    const result = analyzeRecording(recordingOf(samples), SEED);
    assert.equal(result.problem, 'no-holder-sound');
    assert.equal(result.elapsedSeconds, null);
  });

  it('rejects a code from a different seed, so old recordings fail', () => {
    const samples = quietNoise(0.001, 3);
    mix(samples, makeCode('old-session', 'door', SAMPLE_RATE), 1.5, 0.8);
    mix(samples, makeCode('old-session', 'holder', SAMPLE_RATE), 3, 0.8);
    const result = analyzeRecording(recordingOf(samples), SEED);
    assert.equal(result.door, null);
    assert.equal(result.holder, null);
  });

  it('reports overlapping sounds', () => {
    const samples = quietNoise(0.001, 3);
    mix(samples, makeCode(SEED, 'door', SAMPLE_RATE), 1.5, 0.8);
    mix(samples, makeCode(SEED, 'holder', SAMPLE_RATE), 1.5 + CODE_SECONDS / 2, 0.8);
    assert.equal(analyzeRecording(recordingOf(samples), SEED).problem, 'overlap');
  });

  it('reports a lost audio block between the sounds', () => {
    const { door } = simulate({ distanceCm: 30 });
    const middle = Math.round(2.5 * SAMPLE_RATE);
    door.gaps = [[middle, middle + 128]];
    assert.equal(analyzeRecording(door, SEED).problem, 'dropout');
  });

  it('reports a run of exact zeros as a lost block', () => {
    const { door } = simulate({ distanceCm: 30 });
    const middle = Math.round(2.5 * SAMPLE_RATE);
    door.samples.fill(0, middle, middle + 128);
    assert.equal(analyzeRecording(door, SEED).problem, 'dropout');
  });
});

describe('verdict', () => {
  it('passes under 60 cm, fails at 60 cm and beyond, and rejects impossible readings', () => {
    assert.equal(verdictFor(30), 'near');
    assert.equal(verdictFor(-5), 'near');
    assert.equal(verdictFor(60), 'far');
    assert.equal(verdictFor(3430), 'far');
    assert.equal(verdictFor(-20), 'invalid');
    assert.equal(verdictFor(Number.NaN), 'invalid');
  });
});

describe('codes', () => {
  it('are repeatable per seed and role, and differ otherwise', () => {
    const code = makeCode('a', 'door', SAMPLE_RATE);
    assert.deepEqual(makeCode('a', 'door', SAMPLE_RATE), code);
    assert.notDeepEqual(makeCode('a', 'holder', SAMPLE_RATE), code);
    assert.notDeepEqual(makeCode('b', 'door', SAMPLE_RATE), code);
  });

  it('are safe to play without clipping', () => {
    for (const sample of makeCode('a', 'door', SAMPLE_RATE)) assert.ok(Math.abs(sample) <= 0.951);
  });
});
