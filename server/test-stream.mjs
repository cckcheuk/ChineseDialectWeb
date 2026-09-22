// Streaming test: node server/test-stream.mjs <audio.wav>
// Reads a 16k mono PCM16 WAV and sends it to Tencent via /api/asr/stream at real-time rate,
// printing intermediate (slice_type 1) and stable (slice_type 2) results to show "live transcription".
import { readFileSync } from 'node:fs'
import WebSocket from 'ws'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node server/test-stream.mjs <audio.wav>')
  process.exit(1)
}

// Parse the WAV and extract PCM16 data
const buf = readFileSync(file)
if (buf.toString('ascii', 0, 4) !== 'RIFF') {
  console.error('not a WAV file')
  process.exit(1)
}
let dataStart = -1
let dataLen = 0
let p = 12
while (p + 8 <= buf.length) {
  const id = buf.toString('ascii', p, p + 4)
  const len = buf.readUInt32LE(p + 4)
  if (id === 'data') {
    dataStart = p + 8
    dataLen = len
    break
  }
  p += 8 + len + (len % 2)
}
if (dataStart < 0) {
  console.error('data chunk not found')
  process.exit(1)
}
const pcm = buf.subarray(dataStart, dataStart + dataLen)
console.log(`PCM ${pcm.length} bytes ≈ ${(pcm.length / 32000).toFixed(2)}s`)

// Unified parser for Tencent real-time speech recognition responses (compatible with both old and new formats)
// Old format (48982): msg.result.{ slice_type, voice_text_str }   slice_type: 1=intermediate, 2=stable
// New format (V2 / 131127): msg.sentences.{ sentence, sentence_type }   sentence_type: 0=intermediate, 1=stable
function parseAsr(msg) {
  const r = msg.result
  if (r && r.voice_text_str) {
    if (r.slice_type === 1) return { partial: r.voice_text_str }
    if (r.slice_type === 2) return { final: r.voice_text_str.trim() }
    return null
  }
  const s = Array.isArray(msg.sentences) ? msg.sentences[msg.sentences.length - 1] : msg.sentences
  if (s && s.sentence) {
    if (s.sentence_type === 0) return { partial: s.sentence }
    if (s.sentence_type === 1) return { final: s.sentence.trim() }
    return null
  }
  return null
}

const ws = new WebSocket('ws://localhost:3001/api/asr/stream?dialect=cantonese')
let sent = 0
let finals = []

const t = setTimeout(() => {
  console.log('⏱ timeout')
  process.exit(1)
}, 30000)

ws.on('message', (d) => {
  let msg
  try {
    msg = JSON.parse(d.toString())
  } catch {
    return
  }
  if (msg.code !== 0) {
    console.log('❌ error:', msg.message || msg.code)
    clearTimeout(t)
    process.exit(1)
  }
  if (msg.connected) {
    console.log('🔌 connected, sending PCM…')
    return
  }
  const part = parseAsr(msg)
  if (part) {
    if (part.partial) console.log('  partial →', part.partial)
    else if (part.final) {
      console.log('  final sentence →', part.final)
      finals.push(part.final)
    }
  }
  if (msg.final === 1) {
    clearTimeout(t)
    console.log('🏁 done, all results:', finals.join('') || '(empty)')
    ws.close()
    process.exit(0)
  }
})

ws.on('open', () => {
  const CHUNK = 3200 // 100ms
  const tick = () => {
    if (sent >= pcm.length) {
      ws.send(JSON.stringify({ type: 'end' }), { binary: false })
      return
    }
    const end = Math.min(sent + CHUNK, pcm.length)
    ws.send(pcm.subarray(sent, end))
    sent = end
    setTimeout(tick, 100)
  }
  tick()
})

ws.on('error', (e) => {
  console.log('❌ WS error:', e.message)
  clearTimeout(t)
  process.exit(1)
})
