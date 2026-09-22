import { useStore } from '../store'
import { useI18n } from '../i18n'

export default function ConfirmDialog() {
  const { t } = useI18n()
  const confirm = useStore((s) => s.confirm)
  const store = useStore.getState()
  if (!confirm) return null

  const message = confirm.kind === 'clearAll' ? t('clearHistoryConfirm') : t('deleteConvConfirm')

  const doConfirm = () => {
    if (confirm.kind === 'clearAll') store.clearAll()
    else if (confirm.kind === 'deleteConv') store.deleteConversation(confirm.id)
    store.setConfirm(null)
  }

  return (
    <div className="modal-backdrop" onClick={() => store.setConfirm(null)}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="confirm-text">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={() => store.setConfirm(null)}>
            {t('no')}
          </button>
          <button className="btn btn-danger" onClick={doConfirm} autoFocus>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
