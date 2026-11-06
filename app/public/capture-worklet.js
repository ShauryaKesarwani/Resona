// Runs on the audio thread, so it only copies samples and hands them to the page.
// Each batch carries the audio frame it started at, which lets the page spot lost blocks.
const BATCH_FRAMES = 2048;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batch = new Float32Array(BATCH_FRAMES);
    this.filled = 0;
    this.batchFrame = 0;
  }

  flush() {
    if (this.filled === 0) return;
    const samples = this.batch.slice(0, this.filled);
    this.port.postMessage({ frame: this.batchFrame, samples }, [samples.buffer]);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) {
      // No mic data for this block. Flushing leaves a gap the page can detect.
      this.flush();
      return true;
    }
    if (this.filled > 0 && this.batchFrame + this.filled !== currentFrame) this.flush();
    if (this.filled === 0) this.batchFrame = currentFrame;
    this.batch.set(channel, this.filled);
    this.filled += channel.length;
    if (this.filled + channel.length > BATCH_FRAMES) this.flush();
    return true;
  }
}

registerProcessor('capture', CaptureProcessor);
