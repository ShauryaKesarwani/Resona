import { analyzeRecording, type Analysis } from './analyze.ts'
import { SonarAudio } from './audio.ts'
import { makeCode, type Role } from './codes.ts'

const RECORD_SECONDS = 6
const PLAY_AT: Record<Role, number> = { door: 1.5, holder: 3 }

/**
 * Call from a tap. The sonar code is Soha's, unchanged from /lab. The one difference here is that the
 * holder's mic opens before the door joins, so its early audio is thrown away instead of being queued
 * up and mistaken for the recording.
 */
export async function openMic() {
  const audio = new SonarAudio()
  const mic = await audio.open()
  const { capture } = audio as unknown as { capture: AudioWorkletNode }
  capture.port.onmessage = () => {}
  return { audio, sampleRate: mic.sampleRate }
}

/** Records and plays this phone's sound. If that fails it says so, so the other phone isn't left waiting. */
export async function measure(
  audio: SonarAudio, sampleRate: number, seed: string, role: Role,
  tap?: { onBlock?: (samples: Float32Array) => void; onAnalysis?: (analysis: Analysis) => void },
) {
  audio.onBlock = tap?.onBlock ?? null
  try {
    const recording = await audio.run(makeCode(seed, role, sampleRate), PLAY_AT[role], RECORD_SECONDS)
    await new Promise((done) => setTimeout(done, 0))
    const analysis = analyzeRecording(recording, seed)
    tap?.onAnalysis?.(analysis)
    return { elapsedSeconds: analysis.elapsedSeconds, problem: analysis.problem }
  } catch {
    return { elapsedSeconds: null, problem: 'dropout' as const }
  } finally {
    audio.onBlock = null
  }
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

export const micError = () => 'Could not use the microphone. Allow it for this site, then try again.'
