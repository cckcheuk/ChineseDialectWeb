// ─────────────────────────────────────────────────────────────────────────────
// Reserved API surface (real backend + mock fallback)
//
// Real ASR: POST /api/asr/transcribe → server/asr.mjs → Tencent Cloud real-time speech recognition v2 (WebSocket)
//   { "audio": "<16k mono WAV base64>", "dialect": "cantonese|hakka|teochew|hokkien|mandarin", "engine": "16k_zh_en_2.0" }
//   → { "text": "...", "confidence": 0.92 }
//   Engine: default 16k_zh_en (Chinese-English large model 1.0); in mainland China 16k_zh_en_2.0 covers Teochew/Hakka/Hokkien first.
//   Sentence-level recognition / "fast" version lacks Teochew and Hakka support, so don't use it.
//
// Real TTS: POST /api/tts/synthesize
//   { "text": "...", "dialect": "...", "voice": "auto" } → { "audio_url": "data:audio/mp3;base64,..." | null }
//   Routing (server/tts.mjs): Cantonese → Tencent Cloud TTS (VoiceType 101019); other dialects → Cantonese-voice fallback.
//   Frontend plays audio_url via <audio>; if the backend is unreachable it falls back to the browser Web Speech API (mock).
//
// Real LLM: POST /api/chat
// ─────────────────────────────────────────────────────────────────────────────

import { useStore } from '../store'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const MOCK_TRANSCRIPTS = {
  cantonese: '今日天氣幾好，係咪好適合去公園行下呀？',
  hakka: '今日天氣當好，啱啱好適合去公園行下哦？',
  teochew: '今日個天時過好，適合去公園行行？',
  hokkien: '今仔日天氣真好，適合來去公園行行咧？',
  mandarin: '今天天氣很好，是不是很適合去公園走走呀？',
}

const MOCK_REPLIES = {
  cantonese: '係呀！今日天氣真係幾好，建議你出去行下，記得戴帽同飲多啲水呀。',
  hakka: '係哦！今日天氣當好，做得出去行下，記得戴帽仔、多兜水哦。',
  teochew: '是！今日個天時過好，建議你出去行行，孬孬記愛戴帽、食撮水。',
  hokkien: '是啊！今仔日天氣真好，建議你出去行行，記得戴帽仔、加啉水喔。',
  mandarin: '是的！今天天氣很好，建議你出去走走，記得戴上帽子、多喝水。',
}

const MOCK_GREETINGS = {
  cantonese: '你好呀！我係方言助手，好開心同你傾偈。你今日想傾啲乜嘢呀？',
  hakka: '你好哦！我係方言助手，當歡喜同你講話。今晡日想講麼介呀？',
  teochew: '你好！我是潮汕話助手，好欢喜甲你担话。今日想担乜个呀？',
  hokkien: '你好！我是閩南語助手，真歡喜佮你開講。今仔日想講啥物？',
  mandarin: '你好！我是方言助手，很高兴和你聊天。今天想聊些什么呢？',
}

export async function asrTranscribe({ audio, dialect }) {
  // Real endpoint: POST /api/asr/transcribe (server/asr.mjs connects to Tencent Cloud real-time speech recognition v2)
  // The backend auto-selects an engine by dialect: Cantonese → 16k_yue, Mandarin → 16k_zh,
  // Hakka/Teochew/Hokkien → 16k_zh_en_2.0 (large model 2.0, auto-detects 31 dialects).
  let res
  try {
    res = await fetch('/api/asr/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, dialect }),
    })
  } catch {
    // Backend not started → demo mode (mock)
    console.warn('[asr] backend not connected, using demo transcription')
    await delay(900)
    return { text: MOCK_TRANSCRIPTS[dialect] ?? MOCK_TRANSCRIPTS.mandarin, confidence: 0.5, mock: true }
  }
  if (!res.ok) {
    let detail = 'HTTP ' + res.status
    try {
      const data = await res.json()
      if (data.error) detail = data.error
    } catch {
      /* ignore */
    }
    throw new Error('ASR backend: ' + detail)
  }
  const data = await res.json()
  return { text: data.text || '', confidence: data.confidence ?? null, engine: data.engine, mock: false }
}

export async function ttsSynthesize({ text, dialect, voice = 'auto' }) {
  // Try the real backend (Tencent Cloud TTS). If the backend is down/unreachable,
  // fall back to the browser Web Speech API (speech-synthesis://dev) so the speaker
  // button still does something in dev. A deliberate "unsupported dialect / no creds"
  // response returns audio_url: null (frontend shows the "coming soon" toast).
  try {
    const res = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, dialect, voice }),
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    return { audio_url: data.audio_url ?? null, mock: false }
  } catch (err) {
    console.warn('[tts] backend unavailable, using browser TTS mock:', err.message)
    await delay(200)
    return { audio_url: 'speech-synthesis://dev', mock: true }
  }
}

export async function chatSend({ messages, dialect }) {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  const history = [...messages].slice(-12).map((m) => ({ role: m.role, text: m.text }))
  const s = useStore.getState()
  const own = {
    apiKey: s.userApiKey || undefined,
    baseUrl: s.userBaseUrl || undefined,
    model: s.userModel || undefined,
  }
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, dialect, ...own }),
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    if (data.text && data.text.trim()) return { text: data.text.trim(), mock: false }
    throw new Error('reply is empty')
  } catch (err) {
    // Backend not started / LM Studio not open / model not loaded → use demo reply so elderly users don't wait
    console.warn('[chat] using demo reply:', err.message)
    await delay(900)
    if (last && /你好|早晨|hello|哈囉|嗨|how are you/i.test(last.text)) {
      return { text: MOCK_GREETINGS[dialect] ?? MOCK_GREETINGS.mandarin, mock: true }
    }
    return { text: MOCK_REPLIES[dialect] ?? MOCK_REPLIES.mandarin, mock: true }
  }
}
