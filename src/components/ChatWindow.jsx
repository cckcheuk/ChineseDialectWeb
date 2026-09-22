import { useRef, useState, useEffect } from 'react'
import { useStore, FONT_KEYS } from '../store'
import { useI18n } from '../i18n'
import { asrTranscribe, ttsSynthesize, chatSend } from '../services/api'
import { speak, speechSupported, playUrl } from '../audio/speaker'
import Composer from './Composer'
import { MicIcon, SpeakerIcon, XIcon, MenuIcon, SparkleIcon, SunIcon, MoonIcon } from './Icons'

const uid = () => Math.random().toString(36).slice(2, 10)

function fmtTime(ts) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function ChatWindow({ conversation }) {
  const { t, language } = useI18n()
  const dialect = useStore((s) => s.dialect)
  const setLanguage = useStore((s) => s.setLanguage)
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useStore((s) => s.toggleSidebarCollapsed)
  const toggleDrawer = useStore((s) => s.toggleDrawer)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const isTranscribing = useStore((s) => s.isTranscribing)
  const speakingId = useStore((s) => s.speakingId)

  const isProcessing = useStore((s) => s.isProcessing)
  const setProcessing = useStore((s) => s.setProcessing)
  const submittingRef = useRef(false)
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState('checking') // checking | real | mock | nokey
  const listRef = useRef(null)
  const messages = conversation?.messages ?? []
  const empty = !conversation || messages.length === 0

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, isProcessing, isTranscribing])

  useEffect(() => {
    let cancelled = false
    let retries = 0
    const maxRetries = 10
    const checkHealth = () => {
      fetch('/api/health', { signal: AbortSignal.timeout(3000) })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return
          setApiStatus(d.configured ? 'real' : 'nokey')
        })
        .catch(() => {
          if (cancelled) return
          if (retries < maxRetries) {
            retries++
            setTimeout(checkHealth, 1000)
          } else {
            setApiStatus('mock')
          }
        })
    }
    checkHealth()
    return () => { cancelled = true }
  }, [])

  const submitText = async (text) => {
    if (!text.trim() || !conversation) return
    if (submittingRef.current) return // block re-sending while a response is in flight
    submittingRef.current = true
    const convId = conversation.id
    const d = dialect
    const store = useStore.getState()
    const msgs = store.conversations.find((c) => c.id === convId)?.messages ?? []
    store.addMessage(convId, { id: uid(), role: 'user', text: text.trim(), ts: Date.now(), dialect: d })
    setProcessing(true)
    try {
      const res = await chatSend({ messages: [...msgs, { role: 'user', text }], dialect: d })
      store.addMessage(convId, {
        id: uid(),
        role: 'assistant',
        text: res.text,
        ts: Date.now(),
        dialect: d,
      })
    } catch {
      store.showToast(t('chatError'), 'error')
    } finally {
      setProcessing(false)
      submittingRef.current = false
    }
  }

  const handleVoice = async (payload) => {
    // Streaming mode now writes directly into the input box (not via here); below only handles file mode.
    // File mode: payload = { base64 } (16k wav) → POST /api/asr/transcribe (or mock)
    if (!payload?.base64) return
    const store = useStore.getState()
    store.setTranscribing(true)
    try {
      const { text } = await asrTranscribe({ audio: payload.base64, dialect })
      // Recognition result is placed into the input box; it is only sent after the user confirms and presses Send
      store.setDraftText(text)
    } catch (err) {
      console.error('[asr]', err)
      store.showToast(t('asrError'), 'error')
    } finally {
      store.setTranscribing(false)
    }
  }

  const handleSpeak = async (msg) => {
    const store = useStore.getState()
    const d = msg.dialect || dialect
    try {
      const res = await ttsSynthesize({ text: msg.text, dialect: d, voice: 'auto' })
      if (!res.audio_url) {
        store.showToast(t('ttsPending'), 'info')
        return
      }
      store.setSpeakingId(msg.id)
      if (res.audio_url.startsWith('data:audio') || res.audio_url.startsWith('http')) {
        // Real TTS audio from the backend (Tencent Cloud) — play via <audio>.
        await playUrl(res.audio_url)
      } else {
        // Dev fallback (speech-synthesis://dev): browser Web Speech API.
        await speak(msg.text, d)
      }
    } catch (err) {
      console.error('[tts]', err)
      store.showToast(t('ttsError'), 'error')
    } finally {
      store.setSpeakingId(null)
    }
  }

  const suggest = [
    { text: t('suggestWeather') },
    { text: t('suggestGreet') },
    { text: t('suggestThanks') },
  ]

  return (
    <div className="chat">
      <header className="toolbar">
        <button
          className="icon-btn menu-btn"
          aria-label={t('openHistory')}
          onClick={() => {
            if (window.innerWidth < 768) toggleDrawer()
            else toggleSidebarCollapsed()
          }}
        >
          {window.innerWidth < 768 || sidebarCollapsed ? (
            <MenuIcon width={24} height={24} />
          ) : (
            <XIcon width={24} height={24} />
          )}
        </button>
        <h1 className="toolbar-title">{t('appTitle')}</h1>

        <div className="toolbar-actions">
          <span
            className={'api-badge api-' + apiStatus}
            title={
              apiStatus === 'real'
                ? t('apiRealTitle')
                : apiStatus === 'nokey'
                  ? t('apiNoKeyTitle')
                  : apiStatus === 'mock'
                    ? t('apiMockTitle')
                    : ''
            }
          >
            {apiStatus === 'real'
              ? '● ' + t('apiReal')
              : apiStatus === 'nokey'
                ? '● ' + t('apiNoKey')
                : apiStatus === 'mock'
                  ? '● ' + t('apiMock')
                  : '…'}
          </span>

          <div className="menu-wrap font-menu-wrap">
            <button
              className="btn btn-ghost font-menu-btn"
              onClick={() => setFontMenuOpen((v) => !v)}
              aria-expanded={fontMenuOpen}
              aria-haspopup="true"
            >
              <span className="font-a" style={{ fontSize: 19 }}>A</span>
              <span className="font-a" style={{ fontSize: 24 }}>A</span>
            </button>
            {fontMenuOpen && (
              <div className="menu-panel" role="menu">
                <div className="menu-title">{t('fontSizeSetting')}</div>
                {FONT_KEYS.map((key, i) => (
                  <button
                    key={key}
                    role="menuitemradio"
                    aria-checked={useStore.getState().fontScale === i}
                    className="menu-item font-item"
                    onClick={() => {
                      useStore.getState().setFontScale(i)
                      setFontMenuOpen(false)
                    }}
                  >
                    <span style={{ fontSize: 18 + i * 2.5 }}>A</span>
                    <span>{t(key)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn btn-ghost lang-btn"
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
          >
            {language === 'zh' ? 'EN' : '中'}
          </button>

          <button
            className="btn btn-ghost theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('themeLight') : t('themeDark')}
            title={theme === 'dark' ? t('themeLight') : t('themeDark')}
          >
            {theme === 'dark' ? <SunIcon width={22} height={22} /> : <MoonIcon width={22} height={22} />}
          </button>
        </div>
      </header>

      <div className="messages" ref={listRef}>
        {empty ? (
          <div className="welcome">
            <span className="welcome-mark">
              <SparkleIcon width={40} height={40} />
            </span>
            <h2 className="welcome-title">{t('welcomeTitle')}</h2>
            <p className="welcome-sub">{t('welcomeSubtitle')}</p>
            <div className="voice-guide" aria-label={t('voiceGuideTitle')}>
              <div className="voice-guide-head">
                <span className="voice-guide-icon"><MicIcon width={22} height={22} /></span>
                <div>
                  <h3>{t('voiceGuideTitle')}</h3>
                  <p>{t('voiceGuideBody')}</p>
                </div>
              </div>
              <ol className="voice-steps">
                <li>{t('voiceGuideStepOne')}</li>
                <li>{t('voiceGuideStepTwo')}</li>
                <li>{t('voiceGuideStepThree')}</li>
              </ol>
            </div>
            <div className="suggest-row">
              {suggest.map((s) => (
                <button key={s.text} className="chip" onClick={() => submitText(s.text)}>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user'
            const isSpeaking = speakingId === m.id
            return (
              <div key={m.id} className={'msg ' + (isUser ? 'msg-user' : 'msg-ai')}>
                <div className="bubble">{m.text}</div>
                <div className="msg-meta">
                  {isUser ? t('userYou') : t('ai')} · {fmtTime(m.ts)}
                </div>
                {!isUser && (
                  <div className="speak-row">
                    <button
                      className={'speak-btn' + (isSpeaking ? ' speaking' : '')}
                      onClick={() => handleSpeak(m)}
                    >
                      {isSpeaking ? (
                        <>
                          <span className="speaking-dots">
                            <span /><span /><span />
                          </span>
                          {t('speaking')}
                        </>
                      ) : (
                        <>
                          <SpeakerIcon width={18} height={18} />
                          {t('speak')}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}

        {isProcessing && (
          <div className="msg msg-ai">
            <div className="bubble thinking-bubble">
              <span className="speaking-dots big">
                <span /><span /><span />
              </span>
              {t('thinking')}
            </div>
          </div>
        )}
        {isTranscribing && (
          <div className="status-pill">
            <span className="spinner" aria-hidden />
            {t('transcribing')}
          </div>
        )}
      </div>

      <Composer
        onText={submitText}
        onVoice={handleVoice}
        liveAsr={apiStatus === 'real'}
        dialect={dialect}
        showVoiceGuidance={empty}
      />
    </div>
  )
}
