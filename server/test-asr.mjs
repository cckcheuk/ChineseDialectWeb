// Quick test: node server/test-asr.mjs <audio.wav>
// Recognizes a 16k mono WAV using 16k_zh_large (Mandarin/English large model) and prints the result.
// No WAV? Generate a Cantonese test file on macOS:
//   say -v Sin-ji -o /tmp/test.aiff "今日天氣幾好" \
//     && afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/test.aiff /tmp/test.wav
//   node server/test-asr.mjs /tmp/test.wav
import { readFileSync } from 'node:fs'
import './env.mjs'
import { transcribeWav, asrEngine } from './asr.mjs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node server/test-asr.mjs <audio.wav>')
  process.exit(1)
}

console.log(`engine: ${asrEngine()}`)
const base64 = readFileSync(file).toString('base64')
const t0 = Date.now()
try {
  const res = await transcribeWav(base64, 'cantonese')
  console.log(`✓ transcription complete (${Date.now() - t0}ms, engine ${res.engine})`)
  console.log(`  result: ${res.text || '(empty)'}`)
} catch (err) {
  console.error('✗ failed:', err.message)
  process.exit(1)
}
