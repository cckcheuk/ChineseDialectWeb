import { useStore } from '../store'
import { useI18n } from '../i18n'
import { PlusIcon, TrashIcon, GearIcon, XIcon, SparkleIcon } from './Icons'

export default function Sidebar() {
  const { t } = useI18n()
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const drawerOpen = useStore((s) => s.drawerOpen)
  const store = useStore.getState()

  const content = (
    <aside className="sidebar" aria-label={t('history')}>
      <div className="sidebar-head">
        <div className="brand">
          <span className="brand-mark">
            <SparkleIcon width={22} height={22} />
          </span>
          <div>
            <div className="brand-name">{t('appTitle')}</div>
            <div className="brand-sub">{t('appSubtitle')}</div>
          </div>
          <button
            className="icon-btn drawer-close"
            aria-label={t('close')}
            onClick={() => useStore.getState().toggleDrawer()}
          >
            <XIcon width={22} height={22} />
          </button>
        </div>
        <button className="btn btn-primary new-chat" onClick={() => store.newChat()}>
          <PlusIcon width={20} height={20} />
          <span>{t('newChat')}</span>
        </button>
      </div>

      <div className="conv-list" role="list" aria-label={t('history')}>
        {conversations.length === 0 && <p className="empty">{t('emptyHistory')}</p>}
        {conversations.map((c) => (
          <div key={c.id} className={'conv-item' + (c.id === activeId ? ' active' : '')}>
            <button
              className="conv-open"
              onClick={() => store.setActive(c.id)}
              aria-current={c.id === activeId ? 'page' : undefined}
            >
              {c.title || t('newChat')}
            </button>
            <button
              className="icon-btn conv-del"
              aria-label={t('delete')}
              onClick={() => store.setConfirm({ kind: 'deleteConv', id: c.id })}
            >
              <TrashIcon width={20} height={20} />
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <button className="btn btn-secondary block" onClick={() => store.setSettingsOpen(true)}>
          <GearIcon width={20} height={20} />
          <span>{t('settings')}</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className={'sidebar-wrap desktop-only' + (collapsed ? ' collapsed' : '')}>
        {content}
      </div>
      <div className={'drawer' + (drawerOpen ? ' open' : '')} aria-hidden={!drawerOpen}>
        {content}
      </div>
    </>
  )
}
