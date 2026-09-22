import { useEffect } from 'react'
import { useStore, FONT_SCALES } from '../store'
import { useI18n } from '../i18n'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import SettingsModal from './SettingsModal'
import ConfirmDialog from './ConfirmDialog'
import Toast from './Toast'

export default function App() {
  const fontScale = useStore((s) => s.fontScale)
  const fontScaleTouched = useStore((s) => s.fontScaleTouched)
  const theme = useStore((s) => s.theme)
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const drawerOpen = useStore((s) => s.drawerOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const confirm = useStore((s) => s.confirm)
  const { t } = useI18n()

  useEffect(() => {
    if (!conversations.length) useStore.getState().newChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const apply = () => {
      const mobile = window.innerWidth < 768
      // Phones default to the smallest font; desktop keeps the chosen/default size.
      // Once the user explicitly picks a size it is respected on both layouts.
      const idx = mobile && !fontScaleTouched ? 0 : fontScale
      document.documentElement.style.fontSize = FONT_SCALES[Math.min(idx, FONT_SCALES.length - 1)]
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [fontScale, fontScaleTouched])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null

  return (
    <div className="app">
      <Sidebar />
      {drawerOpen && (
        <button
          className="drawer-backdrop"
          aria-label={t('close')}
          onClick={() => useStore.getState().toggleDrawer()}
        />
      )}
      <main className="main">
        <ChatWindow conversation={active} />
      </main>
      {settingsOpen && <SettingsModal />}
      {confirm && <ConfirmDialog />}
      <Toast />
    </div>
  )
}
