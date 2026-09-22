import { useStore, FONT_KEYS } from '../store'
import { useI18n } from '../i18n'
import { XIcon, TrashIcon } from './Icons'

export default function SettingsModal() {
  const { t, language } = useI18n()
  const fontScale = useStore((s) => s.fontScale)
  const userApiKey = useStore((s) => s.userApiKey)
  const userBaseUrl = useStore((s) => s.userBaseUrl)
  const userModel = useStore((s) => s.userModel)
  const store = useStore.getState()

  return (
    <div className="modal-backdrop" onClick={() => store.setSettingsOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('settingsTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 className="modal-title">{t('settingsTitle')}</h2>
          <button
            className="icon-btn"
            aria-label={t('close')}
            onClick={() => store.setSettingsOpen(false)}
          >
            <XIcon width={22} height={22} />
          </button>
        </div>

        <div className="modal-body">
          <section className="setting-group">
            <h3 className="setting-label">{t('languageSetting')}</h3>
            <div className="seg">
              <button
                className={'seg-btn' + (language === 'zh' ? ' active' : '')}
                onClick={() => store.setLanguage('zh')}
              >
                繁體中文
              </button>
              <button
                className={'seg-btn' + (language === 'en' ? ' active' : '')}
                onClick={() => store.setLanguage('en')}
              >
                English
              </button>
            </div>
          </section>

          <section className="setting-group">
            <h3 className="setting-label">{t('ownModelTitle')}</h3>
            <p className="setting-desc">{t('ownModelDesc')}</p>
            <input
              className="chat-input"
              type="password"
              value={userApiKey}
              onChange={(e) => store.setUserApiKey(e.target.value)}
              placeholder={t('apiKeyPlaceholder')}
              aria-label={t('apiKey')}
              style={{ minHeight: 44, marginBottom: 8 }}
            />
            <input
              className="chat-input"
              type="text"
              value={userBaseUrl}
              onChange={(e) => store.setUserBaseUrl(e.target.value)}
              placeholder={t('baseUrlPlaceholder')}
              aria-label={t('baseUrl')}
              style={{ minHeight: 44, marginBottom: 8 }}
            />
            <input
              className="chat-input"
              type="text"
              value={userModel}
              onChange={(e) => store.setUserModel(e.target.value)}
              placeholder={t('modelPlaceholder')}
              aria-label={t('modelName')}
              style={{ minHeight: 44 }}
            />
            <p className="setting-desc" style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
              {t('ownModelExamples')}
            </p>
          </section>

          <section className="setting-group">
            <h3 className="setting-label">{t('fontSizeSetting')}</h3>
            <div className="seg font-seg">
              {FONT_KEYS.map((key, i) => (
                <button
                  key={key}
                  className={'seg-btn font-seg-btn' + (fontScale === i ? ' active' : '')}
                  onClick={() => store.setFontScale(i)}
                >
                  <span className="font-seg-a" style={{ fontSize: 15 + i * 3 }}>
                    A
                  </span>
                  <span>{t(key)}</span>
                </button>
              ))}
            </div>
            <p className="font-preview" style={{ fontSize: 15 + fontScale * 3 }}>
              {t('fontPreview')}
            </p>
          </section>

          <section className="setting-group">
            <h3 className="setting-label danger">{t('clearHistory')}</h3>
            <p className="setting-desc">{t('clearHistoryDesc')}</p>
            <button
              className="btn btn-danger"
              onClick={() => store.setConfirm({ kind: 'clearAll' })}
            >
              <TrashIcon width={20} height={20} />
              <span>{t('clearHistory')}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
