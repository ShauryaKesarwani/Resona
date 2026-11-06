import { analyzeRecording } from './analyze.ts'
import { SonarAudio } from './audio.ts'
import { makeCode, type Role } from './codes.ts'

const RECORD_SECONDS = 6
const PLAY_AT: Record<Role, number> = { door: 1.5, holder: 3 }

/** Call from a tap. Phone audio processing shifts the sound, so a reading with it on can't be trusted. */
export async function openMic() {
  const audio = new SonarAudio()
  const mic = await audio.open()
  if (mic.echoCancellation || mic.noiseSuppression || mic.autoGainControl) {
    await audio.close()
    throw new Error('mic_processing')
  }
  return { audio, sampleRate: mic.sampleRate }
}

/** Records and plays this phone's sound. Returns the time between the two sounds, or null if they were not both heard. */
export async function measure(audio: SonarAudio, sampleRate: number, seed: string, role: Role) {
  const recording = await audio.run(makeCode(seed, role, sampleRate), PLAY_AT[role], RECORD_SECONDS)
  await new Promise((done) => setTimeout(done, 0))
  return analyzeRecording(recording, seed).elapsedSeconds
}

export const micError = (err: unknown) =>
  (err as Error).message === 'mic_processing'
    ? 'This browser kept its microphone processing on, so the distance would be wrong. Use Chrome on Android.'
    : 'Could not use the microphone. Allow it for this site, then try again.'
