import { toTraditional } from './traditional'
// Streaming speech-recognition client: mic PCM → ws://backend /api/asr/stream → Tencent real-time speech recognition
// onPartial(text) — non-final (interim) result, updated incrementally as text arrives
// onFinal(text)   — a final, stable result for one utterance
// session.stop()  — stop recording, wait for Tencent final:1, resolve { text }
// session.cancel()— cancel immediately

// Unified parser for Tencent real-time speech-recognition responses (handles both old and new formats + several fallbacks)
// Old format (48982): msg.result.{ slice_type, voice_text_str }   slice_type: 1=interim, 2=final
// New format (V2 / 131127): msg.sentences.{ sentence, sentence_type }   sentence_type: 0=interim, 1=final
// For some responses slice_type may be 0 (start of an utterance, usually empty) or 1 (interim); treat both as interim.
function parseAsr(msg) {
  if (!msg || typeof msg !== 'object') return null

  // 1) Old format: msg.result.voice_text_str
  const r = msg.result
  if (r && typeof r.voice_text_str === 'string' && r.voice_text_str) {
    if (r.slice_type === 2) return { final: toTraditional(r.voice_text_str.trim()) }
    return { partial: toTraditional(r.voice_text_str) } // slice_type 0/1 both treated as interim results
  }

  // 2) New format: msg.sentences[].{ sentence, sentence_type }
  const s = Array.isArray(msg.sentences) ? msg.sentences[msg.sentences.length - 1] : msg.sentences
  if (s && typeof s.sentence === 'string' && s.sentence) {
    if (s.sentence_type === 1) return { final: toTraditional(s.sentence.trim()) }
    return { partial: toTraditional(s.sentence) }
  }

  // 3) Top-level fallback (some versions put it directly at the top level)
  if (typeof msg.voice_text_str === 'string' && msg.voice_text_str) {
    return msg.slice_type === 2
      ? { final: toTraditional(msg.voice_text_str.trim()) }
      : { partial: toTraditional(msg.voice_text_str) }
  }
  if (typeof msg.text === 'string' && msg.text) {
    return { partial: toTraditional(msg.text) }
  }
  return null
}

export function startStream({ dialect, onPartial, onFinal, onError }) {
  return new Promise((resolve, reject) => {
    let ctx = null
    let node = null
    let source = null
    let micStream = null
    let ws = null

    async function setup() {
      const AC = window.AudioContext || window.webkitAudioContext
      ctx = new AC({ sampleRate: 16000 })
      await ctx.audioWorklet.addModule(new URL('./pcm-processor.js', import.meta.url))
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      source = ctx.createMediaStreamSource(micStream)
      node = new AudioWorkletNode(ctx, 'pcm-processor')
      source.connect(node)
    }

    const cleanup = () => {
      try { node?.port.close() } catch { /* ignore */ }
      try { source?.disconnect() } catch { /* ignore */ }
      try { node?.disconnect() } catch { /* ignore */ }
      micStream?.getTracks().forEach((t) => t.stop())
      try { ctx?.close() } catch { /* ignore */ }
    }

    setup()
      .then(() => {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        ws = new WebSocket(
          `${proto}://${location.host}/api/asr/stream?dialect=${encodeURIComponent(dialect)}`
        )
        // Backend may forward Tencent JSON as a binary frame; handle it uniformly as a string
        ws.binaryType = 'arraybuffer'

        const finals = []
        let ended = false
        let acked = false
        let finished = false
        let finishResolve
        let finishReject
        const finishPromise = new Promise((res, rej) => {
          finishResolve = res
          finishReject = rej
        }).catch(() => {}) // Swallow: fatal session errors are surfaced via onError, not as unhandled rejections
        const settle = () => {
          if (!finished) {
            finished = true
            finishResolve({ text: finals.join('') })
          }
        }
        const fail = (msg) => {
          if (!finished) {
            finished = true
            finishReject(new Error(msg))
          }
        }

        const session = {
          stop: async () => {
            if (ended) return { text: finals.join('') }
            ended = true
            // Best-effort: ask Tencent to return the consolidated final transcript
            if (ws && ws.readyState === 1) {
              try { ws.send(JSON.stringify({ type: 'end' })) } catch { /* ignore */ }
            }
            // Stop capturing audio right away so ASR can no longer keep listening
            cleanup()
            // Briefly wait for Tencent's final:1 so we can capture the final text, then close
            const grace = new Promise((res) => setTimeout(res, 600))
            try { await Promise.race([finishPromise, grace]) } catch { /* ignore */ }
            try { if (ws && ws.readyState !== 3) ws.close() } catch { /* ignore */ }
            return { text: finals.join('') }
          },
          cancel: () => {
            if (ended) return
            ended = true
            cleanup()
            try { ws && ws.close() } catch { /* ignore */ }
          },
        }

        node.port.onmessage = (e) => {
          if (ended) return // already stopped, don't send more audio
          if (ws.readyState === 1) ws.send(e.data)
        }

        ws.onmessage = (e) => {
          // Normalize to string (handles both text / binary (ArrayBuffer) frames)
          let raw
          if (typeof e.data === 'string') raw = e.data
          else if (e.data instanceof ArrayBuffer) raw = new TextDecoder().decode(e.data)
          else raw = ''
          console.log('[stream] onmessage raw:', raw.slice(0, 120))
          try {
            let msg
            try {
              msg = JSON.parse(raw)
            } catch {
              return
            }
            if (msg.code !== 0) {
              onError?.(msg)
              if (!acked) {
                cleanup()
                try { ws.close() } catch { /* ignore */ }
                reject(new Error(msg.message || `ASR ${msg.code}`))
                return
              }
              fail(msg.message || `ASR ${msg.code}`)
              return
            }
            if (msg.connected) {
              acked = true
              resolve(session)
              return
            }
            const part = parseAsr(msg)
            if (part) {
              if (part.final) {
                finals.push(part.final)
                onFinal?.(part.final)
              } else if (part.partial) {
                onPartial?.(part.partial)
              }
            }
            if (msg.final === 1) {
              settle()
              cleanup()
              try { ws.close() } catch { /* ignore */ }
            }
          } catch (err) {
            console.error('[stream] onmessage error:', err)
            if (!acked) {
              cleanup()
              try { ws.close() } catch { /* ignore */ }
              reject(err)
            } else {
              fail(err.message)
            }
          }
        }

        ws.onerror = () => {
          if (!acked) {
            cleanup()
            reject(new Error('Stream connection failed (is the backend running?)'))
          } else {
            fail('Stream connection interrupted')
          }
        }
        ws.onclose = () => {
          if (!acked) {
            cleanup()
            reject(new Error('Stream closed'))
          } else if (!ended && !finished) {
            fail('Stream closed prematurely')
          }
        }
      })
      .catch((err) => reject(err))
  })
}
