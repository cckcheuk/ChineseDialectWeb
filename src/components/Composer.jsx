import { useRef, useState } from 'react'
import { useStore } from '../store'
import { useI18n } from '../i18n'
import { createRecorder } from '../audio/recorder'
import { startStream } from '../audio/stream'
import { MicIcon, PauseIcon, SendIcon } from './Icons'

function fmtDur(s) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

// liveAsr=true  → streaming (text appears as you speak, routed through server/asr to Tencent)
// liveAsr=false → send after recording stops (MediaRecorder → 16k wav → /api/asr/transcribe or mock)
export default function Composer({ onText, onVoice, liveAsr, dialect, showVoiceGuidance = false }) {
  const { t } = useI18n()
  const isRecording = useStore((s) => s.isRecording)
  const isTranscribing = useStore((s) => s.isTranscribing)
  const isProcessing = useStore((s) => s.isProcessing)
  const [seconds, setSeconds] = useState(0)
  // ASR result is temporarily stored in the input box (store.draftText) until the user confirms and presses Send
  const text = useStore((s) => s.draftText)
  const setText = (v) => useStore.getState().setDraftText(v)
  const [mode, setMode] = useState(null) // 'stream' | 'file'
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const timerRef = useRef(null)
  const confirmedRef = useRef('') // finalized sentences (accumulated during streaming)
  const stopRequestedRef = useRef(false) // set when the user hits stop while still connecting
  const busy = isRecording || isTranscribing || isProcessing

  const resetRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    useStore.getState().setRecording(false)
    setSeconds(0)
    setMode(null)
  }

  const startRecord = async () => {
    try {
      stopRequestedRef.current = false
      // Cancel any previous session that may still be alive (its callbacks would otherwise
      // write stale text into the new session's shared confirmedRef).
      if (streamRef.current) {
        try { streamRef.current.cancel() } catch { /* ignore */ }
        streamRef.current = null
      }
      if (liveAsr) {
        confirmedRef.current = ''
        setText('')
        const session = await startStream({
          dialect,
          // Live transcription: text box shows "confirmed text + current interim result"
          onPartial: (txt) => {
            // Live transcription: text box shows "confirmed sentence + current interim result"
            setText(confirmedRef.current + txt)
          },
          // On a finalized sentence → append to text box, but do not auto-send; wait for the user to confirm and press Send
          onFinal: (txt) => {
            confirmedRef.current += txt
            setText(confirmedRef.current)
          },
          onError: (msg) => {
            useStore.getState().showToast(msg.message || t('asrError'), 'error')
          },
        })
        streamRef.current = session
        setMode('stream')
        // If the user hit stop while we were still connecting, tear the session down now
        if (stopRequestedRef.current) {
          try { session.cancel() } catch { /* ignore */ }
          streamRef.current = null
          resetRecording()
          return
        }
        // Streaming mode has no recorder timer, so start our own 1-second timer for the UI
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      } else {
        const recorder = await createRecorder({
          onTick: (s) => setSeconds(s),
          onMax: () => {
            if (recRef.current) stopRecord()
          },
        })
        recRef.current = recorder
        recorder.start()
        setMode('file')
      }
      useStore.getState().setRecording(true)
    } catch (err) {
      console.error('[asr] failed to start recording:', err)
      useStore.getState().showToast(err.message || t('asrError'), 'error')
    }
  }

  const stopRecord = async () => {
    stopRequestedRef.current = true
    if (streamRef.current) {
      const session = streamRef.current
      streamRef.current = null
      resetRecording()
      // Wrap-up: keep the text box contents so the user can review before pressing Send
      try {
        await session.stop()
      } catch (err) {
        console.error('[asr]', err)
        useStore.getState().showToast(err.message || t('asrError'), 'error')
      }
    } else if (recRef.current) {
      const recorder = recRef.current
      recRef.current = null
      resetRecording()
      try {
        const result = await recorder.stop()
        if (result.base64) onVoice?.({ base64: result.base64 })
      } catch {
        useStore.getState().showToast(t('asrError'), 'error')
      }
    }
  }

  const send = () => {
    if (busy || !text.trim()) return
    onText?.(text)
    setText('')
  }

  return (
    <div className="composer">
      {isRecording && (
        <div className="recording-hint" role="status" aria-live="assertive">
          <span className="record-dot" aria-hidden />
          <span className="record-timer">{fmtDur(seconds)}</span>
          <span className="record-hint">{t('recording')}</span>
        </div>
      )}
      {showVoiceGuidance && !isRecording && (
        <p className="voice-action-hint" aria-live="polite">{t('voiceAction')}</p>
      )}
      <div className="composer-inner">
        <button
          className={'record-btn' + (isRecording ? ' recording' : '')}
          onClick={isRecording ? stopRecord : startRecord}
          disabled={isTranscribing}
          aria-label={isRecording ? t('stop') : t('recording')}
          title={isRecording ? t('stop') : t('recording')}
        >
          {isRecording ? <PauseIcon width={26} height={26} /> : <MicIcon width={26} height={26} />}
        </button>
        <textarea
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !busy) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={t('typeHere')}
          rows={1}
          aria-label={t('textInput')}
        />
        <button
          className="btn btn-primary send-btn"
          onClick={send}
          disabled={!text.trim() || busy}
          aria-label={t('send')}
        >
          <SendIcon width={20} height={20} />
        </button>
      </div>
    </div>
  )
}
