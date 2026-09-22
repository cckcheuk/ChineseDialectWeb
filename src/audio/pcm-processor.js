// AudioWorklet: convert mic input into a 16k mono PCM16 stream
// Accumulate input each process cycle and send a 1280-byte packet (16000Hz × 2bytes × 0.04s) to the main thread every 40ms
// If the browser won't let AudioContext run at 16000Hz, downsample via linear interpolation using sampleRate.

const TARGET_RATE = 16000
const CHUNK_MS = 40
const TARGET_PER_CHUNK = Math.round((TARGET_RATE * CHUNK_MS) / 1000) // 640 samples = 1280 bytes

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._pending = new Float32Array(0)
    this._step = sampleRate / TARGET_RATE
  }

  _append(input) {
    if (!input || !input.length) return
    const newData = input
    const out = new Float32Array(this._pending.length + newData.length)
    out.set(this._pending)
    out.set(newData, this._pending.length)
    this._pending = out
  }

  _flush() {
    const need = Math.ceil(TARGET_PER_CHUNK * this._step)
    while (this._pending.length >= need) {
      const out = new Float32Array(TARGET_PER_CHUNK)
      for (let i = 0; i < TARGET_PER_CHUNK; i++) {
        const pos = i * this._step
        const i0 = Math.floor(pos)
        const i1 = Math.min(i0 + 1, this._pending.length - 1)
        const frac = pos - i0
        out[i] = this._pending[i0] + (this._pending[i1] - this._pending[i0]) * frac
      }
      const pcm = new Int16Array(TARGET_PER_CHUNK)
      for (let i = 0; i < TARGET_PER_CHUNK; i++) {
        const s = Math.max(-1, Math.min(1, out[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer])
      this._pending = this._pending.slice(need)
    }
  }

  process(inputs) {
    const input = inputs[0]
    if (input && input[0]) this._append(input[0])
    this._flush()
    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
