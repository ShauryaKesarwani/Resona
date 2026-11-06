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

/** Records and plays this phone's sound, then returns the time between the two sounds, or why it couldn't tell. */
export async function measure(audio: SonarAudio, sampleRate: number, seed: string, role: Role) {
  const recording = await audio.run(makeCode(seed, role, sampleRate), PLAY_AT[role], RECORD_SECONDS)
  await new Promise((done) => setTimeout(done, 0))
  const { elapsedSeconds, problem } = analyzeRecording(recording, seed)
  return { elapsedSeconds, problem }
}

const SOUND_NAME: Record<string, string> = { 'no-door-sound': 'the door phone', 'no-holder-sound': 'the holder phone' }

/** Says which phone failed to hear which sound, because that is what tells you what to fix. */
export function problemText(problem?: string) {
  if (!problem) return ''
  const [phone, cause] = problem.split(':')
  const who = phone === 'door' ? 'The door phone' : 'The holder phone'
  if (SOUND_NAME[cause]) return `${who} could not hear ${SOUND_NAME[cause]}.`
  if (cause === 'overlap') return 'The two sounds overlapped.'
  return `${who} lost some audio during the check.`
}

export const micError = (err: unknown) =>
  (err as Error).message === 'mic_processing'
    ? 'This browser kept its microphone processing on, so the distance would be wrong. Use Chrome on Android.'
    : 'Could not use the microphone. Allow it for this site, then try again.'
