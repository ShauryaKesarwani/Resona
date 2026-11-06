// Shared by the phones and the server, so this file has no browser or FFT imports.

/** Half the speed of sound in cm/s: a time difference covers the distance twice. */
const HALF_SPEED_OF_SOUND_CM_S = 17150;
export const NEAR_CM = 60;
/** Readings below this can't be real. They mean a detection went wrong. */
export const IMPOSSIBLE_CM = -20;

export type Verdict = 'near' | 'far' | 'invalid';

/**
 * Each phone measures the time between the door's sound and the holder's sound on its own
 * recording. Speaker and software delays are the same in both, so subtracting cancels them.
 */
export function distanceCm(doorElapsedSeconds: number, holderElapsedSeconds: number): number {
  return HALF_SPEED_OF_SOUND_CM_S * (doorElapsedSeconds - holderElapsedSeconds);
}

export function verdictFor(cm: number): Verdict {
  if (!Number.isFinite(cm) || cm <= IMPOSSIBLE_CM) return 'invalid';
  return cm < NEAR_CM ? 'near' : 'far';
}
