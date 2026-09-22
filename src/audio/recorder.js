// MediaRecorder capture → 16k mono WAV (the most stable format for Tencent ASR)
// Flow: webm/mp4 → AudioContext decode → OfflineAudioContext downmix + resample to 16k mono
//      → encode as WAV (PCM16) → base64

const TARGET_RATE = 16000
const MAX_SECONDS = 120

function encodeWav(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buf)
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '')
    fr.onerror = () => reject(new Error('read file error'))
    fr.readAsDataURL(blob)
  })
}

async function to16kMonoWav(blob) {
  const AC = window.AudioContext || window.webkitAudioContext
  const ac = new AC()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const decoded = await ac.decodeAudioData(arrayBuffer)
    const frames = Math.max(1, Math.round(decoded.duration * TARGET_RATE))
    const oac = new OfflineAudioContext(1, frames, TARGET_RATE)
    const src = oac.createBufferSource()
    src.buffer = decoded
    src.connect(oac.destination)
    src.start(0)
    const rendered = await oac.startRendering()
    const samples = rendered.getChannelData(0)
    const wav = encodeWav(samples, TARGET_RATE)
    const base64 = await blobToBase64(wav)
    return { base64, wav, duration: decoded.duration }
  } finally {
    ac.close().catch(() => {})
  }
}

export async function createRecorder({ onTick, onMax }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : ''

  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks = []
  const startedAt = Date.now()
  let timer = null
  let finished = false

  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data)
  }

  function start() {
    chunks.length = 0
    rec.start(250)
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      onTick?.(seconds)
      if (seconds >= MAX_SECONDS) {
        clearInterval(timer)
        onMax?.()
      }
    }, 250)
  }

  function stop() {
    return new Promise((resolve, reject) => {
      if (finished) return
      finished = true
      clearInterval(timer)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        try {
          resolve(await to16kMonoWav(blob))
        } catch (err) {
          reject(err)
        }
      }
      if (rec.state !== 'inactive') rec.stop()
      else {
        stream.getTracks().forEach((t) => t.stop())
        resolve({ base64: '', wav: null, duration: 0 })
      }
    })
  }

  function cancel() {
    if (finished) return
    finished = true
    clearInterval(timer)
    try {
      if (rec.state !== 'inactive') rec.stop()
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop())
  }

  return { start, stop, cancel }
}
