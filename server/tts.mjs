// Tencent Cloud TTS (TextToVoice) client.
//
// Uses the standard Tencent Cloud API 3.0 TC3-HMAC-SHA256 signed HTTP request.
// Reuses the same CAM credentials as ASR: TENCENT_SECRET_ID / TENCENT_SECRET_KEY.
//
// Voice routing by dialect:
//   cantonese → 101019 (the only Cantonese TTS voice Tencent Cloud offers)
//   all other dialects → use the Cantonese voice as a temporary fallback
//     (Mandarin voices exist; add them to TTS_VOICE_MAP to enable one.)

import crypto from 'node:crypto'

const TTS_ENDPOINT = 'tts.tencentcloudapi.com'
const TTS_SERVICE = 'tts'
const TTS_ACTION = 'TextToVoice'
const TTS_VERSION = '2019-08-23'

// Dialect → Tencent VoiceType. 101019 = Cantonese.
const TTS_VOICE_MAP = {
  cantonese: 101019,
  // mandarin: 101001, // Mandarin voices exist; enable if desired
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}
function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest()
}
function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex')
}

function requireCreds() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  if (!secretId || !secretKey) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY not set (add them to .env)')
  }
  return { secretId, secretKey }
}

export async function ttsSynthesize(text, dialect) {
  // Only Cantonese has a Tencent TTS voice (101019). For any other dialect, fall back to
  // the Cantonese voice so the speaker button always produces audio. The bot's reply is
  // still generated in the requested dialect; it just plays with the Cantonese voice.
  const voiceType = TTS_VOICE_MAP[dialect] || TTS_VOICE_MAP.cantonese
  if (!voiceType) return { audio_url: null, reason: 'unsupported-dialect' }

  const { secretId, secretKey } = requireCreds()
  const region = process.env.TENCENT_TTS_REGION || 'ap-hongkong'

  const payload = JSON.stringify({
    Text: text,
    SessionId: crypto.randomBytes(8).toString('hex'),
    VoiceType: voiceType,
    Codec: 'mp3',
    SampleRate: 16000,
  })

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10) // UTC YYYY-MM-DD

  const hashedPayload = sha256Hex(payload)
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${TTS_ENDPOINT}\n`
  const signedHeaders = 'content-type;host'
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, hashedPayload].join('\n')

  const credentialScope = `${date}/${TTS_SERVICE}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const secretDate = hmac('TC3' + secretKey, date)
  const secretService = hmac(secretDate, TTS_SERVICE)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmacHex(secretSigning, stringToSign)

  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(`https://${TTS_ENDPOINT}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'X-TC-Action': TTS_ACTION,
      'X-TC-Version': TTS_VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region,
    },
    body: payload,
  })
  const data = await res.json()
  if (data.Response && data.Response.Error) {
    const e = data.Response.Error
    throw new Error(`TTS ${e.Code}: ${e.Message}`)
  }
  const audioB64 = data.Response && data.Response.Audio
  if (!audioB64) throw new Error('TTS returned no audio')
  return { audio_url: `data:audio/mp3;base64,${audioB64}` }
}
