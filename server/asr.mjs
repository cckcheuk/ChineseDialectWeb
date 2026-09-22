import { toTraditional } from '../src/audio/traditional.js'
// ─────────────────────────────────────────────────────────────────────────────
// Tencent Cloud real-time speech recognition (WebSocket) client
// Docs: https://cloud.tencent.com/document/product/1093/48982
//      (V2 speaker-diarization version: https://cloud.tencent.com/document/product/1093/131127)
//
// Handshake URL: wss://asr.cloud.tencent.com/asr/v2/<appid>?{request params}  (global endpoint; Tencent has no regional ASR host)
// Signature: Base64Encode(HmacSha1("asr.cloud.tencent.com/asr/v2/<appid>?<sorted URL-encoded params>", secretKey))
//
// Engine routing:
//   cantonese → 16k_yue   (standard Cantonese engine, always available)
//   mandarin   → 16k_zh    (standard Mandarin engine, always available)
//   hakka / teochew / hokkien → 16k_zh_en_2.0 (the only engine that can recognise these;
//        it requires the "large model 2.0" capability to be enabled on the Tencent account.
//        If it isn't enabled, ASR for those dialects fails — surfaced as a toast, not a crash.)
// TENCENT_ENGINE env var can still override the engine for all dialects.
// ─────────────────────────────────────────────────────────────────────────────

import WebSocket from 'ws'
import crypto from 'node:crypto'

// Per-dialect engine map. The app currently defaults to Cantonese, so 16k_yue is what's used
// in practice; the others are kept so the mapping is correct if the dialect is ever switched.
const DIALECT_ENGINES = {
  cantonese: '16k_yue',
  mandarin: '16k_zh',
  hakka: '16k_zh_en_2.0',
  teochew: '16k_zh_en_2.0',
  hokkien: '16k_zh_en_2.0',
}

export function asrEngine(dialect = 'mandarin') {
  return process.env.TENCENT_ENGINE || DIALECT_ENGINES[dialect] || '16k_yue'
}

function buildUrl({ appid, secretId, secretKey, engine, voiceId, voiceFormat = 12, hotwords = '' }) {
  const timestamp = Math.floor(Date.now() / 1000)
  const expired = timestamp + 3600
  const nonce = Math.floor(Math.random() * 1e9) + 1

  const params = {
    secretid: secretId,
    timestamp: String(timestamp),
    expired: String(expired),
    nonce: String(nonce),
    engine_model_type: engine,
    voice_id: voiceId,
    voice_format: String(voiceFormat), // 1 = pcm, 12 = wav
    needvad: '1', // Enable VAD voice-activity detection segmentation to improve sentence boundaries
    convert_num_mode: '1', // Smart conversion of Arabic numerals
    filter_punc: '0', // Keep end-of-sentence punctuation
    filter_dirty: '1', // Filter profanity
    filter_modal: '1', // Partially filter filler words (elderly speech often includes "la"/"ah")
    // V2 engine (16k_zh_en_2.0) params, see https://cloud.tencent.com/document/product/1093/131127
    filter_empty_result: '1', // Don't return empty results
    sentence_strategy: process.env.TENCENT_SENTENCE_STRATEGY || '0', // 0=minimal semantic segmentation (finalize each sentence as it settles), 1=paragraph segmentation
  }
  if (process.env.TENCENT_DOMAIN) params.domain = process.env.TENCENT_DOMAIN // Domain optimization (1 tech / 2 movie / 3 song)
  if (hotwords) params.hotword_list = hotwords // Temporary hotword list (improves accuracy of dialect colloquial terms)

  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')

  const hostPath = `${process.env.TENCENT_ASR_HOST || 'asr.cloud.tencent.com'}/asr/v2/${appid}`
  const signature = crypto.createHmac('sha1', secretKey).update(`${hostPath}?${query}`).digest('base64')

  return `wss://${hostPath}?${query}&signature=${encodeURIComponent(signature)}`
}

function requireCreds() {
  const appid = process.env.TENCENT_APPID
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  if (!appid || !secretId || !secretKey) {
    throw new Error('TENCENT_APPID / TENCENT_SECRET_ID / TENCENT_SECRET_KEY not set (please fill in .env)')
  }
  return { appid, secretId, secretKey }
}

// Open a WebSocket to Tencent real-time speech recognition (for streaming, voice_format=1 PCM)
export function openTencentStream(engine = asrEngine(), hotwords = process.env.TENCENT_HOTWORDS || '') {
  const { appid, secretId, secretKey } = requireCreds()
  const voiceId = crypto.randomBytes(8).toString('hex') // 16 chars
  const url = buildUrl({ appid, secretId, secretKey, engine, voiceId, voiceFormat: 1, hotwords })
  return new WebSocket(url)
}

// Unified parser for Tencent real-time speech recognition responses (compatible with both old and new formats)
// Old format (doc 48982): msg.result.{ slice_type, voice_text_str }
//   slice_type: 1 = recognizing an utterance (intermediate result), 2 = utterance recognition finished (stable result)
// New format (V2 doc 131127): msg.sentences.{ sentence, sentence_type, speaker_id, ... }
//   sentence_type: 0 = uncertain (intermediate result), 1 = certain (stable result)
export function parseAsrMessage(msg) {
  const r = msg.result
  if (r && typeof r.voice_text_str === 'string' && r.voice_text_str) {
    if (r.slice_type === 1) return { partial: toTraditional(r.voice_text_str) }
    if (r.slice_type === 2) return { final: toTraditional(r.voice_text_str.trim()) }
    return null
  }
  const s = Array.isArray(msg.sentences) ? msg.sentences[msg.sentences.length - 1] : msg.sentences
  if (s && typeof s.sentence === 'string' && s.sentence) {
    if (s.sentence_type === 0) return { partial: toTraditional(s.sentence) }
    if (s.sentence_type === 1) return { final: toTraditional(s.sentence.trim()) }
    return null
  }
  return null
}

export async function transcribeWav(wavBase64, dialect, engineOverride) {
  const { appid, secretId, secretKey } = requireCreds()

  const engine = engineOverride || asrEngine(dialect)
  const voiceId = crypto.randomBytes(8).toString('hex') // 16 chars
  const url = buildUrl({
    appid,
    secretId,
    secretKey,
    engine,
    voiceId,
    voiceFormat: 12,
    hotwords: process.env.TENCENT_HOTWORDS || '',
  })
  const audio = Buffer.from(wavBase64, 'base64')

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const sentences = []
    let finalReceived = false
    const timer = setTimeout(() => {
      try { ws.close() } catch { /* ignore */ }
      reject(new Error('recognition timed out (30s)'))
    }, 30000)

    ws.on('open', () => {
      // Send one packet per 100ms, send once every 100ms (~1:1 real-time rate) to avoid triggering the "sending too fast" error (4000)
      const CHUNK = 3200 // 16k mono 16bit = 3200 bytes / 100ms
      let offset = 0
      const tick = () => {
        if (offset >= audio.length) {
          ws.send(JSON.stringify({ type: 'end' }), { binary: false })
          return
        }
        const end = Math.min(offset + CHUNK, audio.length)
        if (ws.readyState === WebSocket.OPEN) ws.send(audio.subarray(offset, end))
        offset = end
        setTimeout(tick, 100)
      }
      tick()
    })

    ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      if (msg.code !== 0) {
        clearTimeout(timer)
        ws.close()
        reject(new Error(`${asrErrorText(msg.code)} (${msg.code})${msg.message ? ': ' + msg.message : ''}`))
        return
      }
      const part = parseAsrMessage(msg)
      if (part?.final) sentences.push(part.final)
      if (msg.final === 1) {
        finalReceived = true
        clearTimeout(timer)
        ws.close()
        resolve({ text: sentences.join(''), confidence: null, engine })
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error('WebSocket connection failed: ' + err.message))
    })

    ws.on('close', () => {
      clearTimeout(timer)
      if (!finalReceived) reject(new Error('connection closed prematurely; final recognition result not received'))
    })
  })
}

// Error code reference (see the "Error Codes" section of the docs)
const ASR_ERRORS = {
  4000: 'Audio sent too fast (real-time rate exceeded 1:1)',
  4001: 'Invalid parameters',
  4002: 'Authentication failed (check AppID/SecretId/SecretKey)',
  4003: 'AppID service not activated',
  4004: 'Resource package exhausted',
  4005: 'Account overdue',
  4006: 'Concurrency limit exceeded',
  4007: 'Audio decode failed (check format/sample rate)',
  4008: 'No audio sent for over 15 seconds',
  4009: 'Client connection dropped',
  4010: 'Unknown text message uploaded',
  6001: 'Overseas call (use Tencent Cloud International or disable proxy)',
}

function asrErrorText(code) {
  return ASR_ERRORS[code] || 'recognition failed'
}
