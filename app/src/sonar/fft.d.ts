declare module 'fft.js' {
  export default class FFT {
    constructor(size: number);
    transform(out: Float64Array, data: Float64Array): void;
    inverseTransform(out: Float64Array, data: Float64Array): void;
  }
}
