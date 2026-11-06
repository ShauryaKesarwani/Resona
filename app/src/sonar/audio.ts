import type { Recording } from './analyze.ts';

export interface MicSettings {
  // Newer browsers can report a mode such as "all" here, not only true or false.
  echoCancellation: boolean | string | undefined;
  noiseSuppression: boolean | undefined;
  autoGainControl: boolean | undefined;
  sampleRate: number;
}

/** Very quiet constant output. Long silence can make browsers change their output delay. */
const KEEP_ALIVE_LEVEL = 0.000001;
const RECORDING_TIMEOUT_MARGIN_MS = 4000;

/** Must be created from a tap, because browsers block audio until the user interacts. */
export class SonarAudio {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  async open(): Promise<MicSettings> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser can only use the microphone over HTTPS.');
    }
    const context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    await context.resume();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
      },
    });

    await context.audioWorklet.addModule('/capture-worklet.js');
    const capture = new AudioWorkletNode(context, 'capture', { numberOfOutputs: 1 });
    const silent = context.createGain();
    silent.gain.value = 0;
    context.createMediaStreamSource(stream).connect(capture);
    capture.connect(silent);
    silent.connect(context.destination);

    const keepAlive = context.createConstantSource();
    keepAlive.offset.value = KEEP_ALIVE_LEVEL;
    keepAlive.connect(context.destination);
    keepAlive.start();

    this.context = context;
    this.stream = stream;
    this.capture = capture;
    this.wakeLock = await navigator.wakeLock?.request('screen').catch(() => null);

    const settings = stream.getAudioTracks()[0].getSettings();
    return {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
      sampleRate: context.sampleRate,
    };
  }

  /** Records for the given time, playing the code once at `playAtSeconds` from the start. */
  run(code: Float32Array, playAtSeconds: number, recordSeconds: number): Promise<Recording> {
    const { context, capture } = this;
    if (!context || !capture) return Promise.reject(new Error('Audio is not open.'));

    const sampleRate = context.sampleRate;
    const samples = new Float32Array(Math.round(recordSeconds * sampleRate));
    // The mic may have been open for a while. Blocks from before this run are stale, not part of it.
    const startFrame = Math.round(context.currentTime * sampleRate);

    const buffer = context.createBuffer(1, code.length, sampleRate);
    buffer.copyToChannel(new Float32Array(code), 0);
    const player = context.createBufferSource();
    player.buffer = buffer;
    player.connect(context.destination);

    return new Promise((resolve, reject) => {
      const gaps: Array<[number, number]> = [];
      let firstFrame = -1;
      let written = 0;

      const finish = () => {
        window.clearTimeout(timeout);
        capture.port.onmessage = null;
        if (written < samples.length) gaps.push([written, samples.length]);
        resolve({ samples, sampleRate, gaps });
      };
      const timeout = window.setTimeout(() => {
        capture.port.onmessage = null;
        reject(new Error('The microphone stopped delivering audio.'));
      }, recordSeconds * 1000 + RECORDING_TIMEOUT_MARGIN_MS);

      capture.port.onmessage = ({ data }: MessageEvent<{ frame: number; samples: Float32Array }>) => {
        if (data.frame < startFrame) return;
        if (firstFrame < 0) {
          firstFrame = data.frame;
          player.start(context.currentTime + playAtSeconds);
        }
        const offset = data.frame - firstFrame;
        if (offset > written) gaps.push([written, Math.min(offset, samples.length)]);
        const available = Math.min(data.samples.length, samples.length - offset);
        if (available > 0) {
          samples.set(data.samples.subarray(0, available), offset);
          written = Math.max(written, offset + available);
        }
        if (offset + data.samples.length >= samples.length) finish();
      };
    });
  }

  async close(): Promise<void> {
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.wakeLock?.release().catch(() => undefined);
    await this.context?.close();
    this.context = null;
    this.stream = null;
    this.capture = null;
    this.wakeLock = null;
  }
}
