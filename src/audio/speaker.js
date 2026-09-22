// Dev-only mock TTS: use the browser Web Speech API (speechSynthesis) to read text aloud.
// The production version calls the backend /api/tts/synthesize to get an audio_url and plays it via <audio>.

let voices = []
function refreshVoices() {
  try {
    voices = window.speechSynthesis.getVoices()
  } catch {
    voices = []
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.onvoiceschanged = refreshVoices
}

const LANG_MAP = {
  cantonese: 'zh-HK',
  hakka: 'zh-HK',
  teochew: 'zh-HK',
  hokkien: 'zh-TW',
  mandarin: 'zh-CN',
}

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text, dialect) {
  return new Promise((resolve) => {
    if (!speechSupported()) {
      resolve()
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = LANG_MAP[dialect] || 'zh-HK'
    u.rate = 0.95
    u.pitch = 1.0
    const match = voices.find((v) => v.lang.replace('_', '-').startsWith(u.lang.slice(0, 5)))
    if (match) u.voice = match
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  })
}

// Play a real audio URL (e.g. a data: URI returned by the Tencent TTS backend) via <audio>.
let currentAudio = null
export function playUrl(url) {
  return new Promise((resolve, reject) => {
    stopPlayback()
    const audio = new Audio(url)
    currentAudio = audio
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
      resolve()
    }
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null
      reject(new Error('audio playback failed'))
    }
    audio.play().catch((e) => {
      currentAudio = null
      reject(e)
    })
  })
}

function stopPlayback() {
  if (currentAudio) {
    try {
      currentAudio.pause()
    } catch {
      /* ignore */
    }
    currentAudio = null
  }
}

export function stopSpeaking() {
  stopPlayback()
  if (speechSupported()) window.speechSynthesis.cancel()
}
