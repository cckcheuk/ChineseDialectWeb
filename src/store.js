import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const FONT_SCALES = ['18px', '20px', '23px', '26px', '30px']
export const FONT_KEYS = ['fontS', 'fontM', 'fontL', 'fontXL', 'fontXXL']

const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => Date.now()

const titleFrom = (text) => {
  const s = text.trim().replace(/\s+/g, ' ')
  return s.length > 14 ? s.slice(0, 14) + '…' : s
}

export const useStore = create(
  persist(
    (set) => ({
      // ---- persisted preferences ----
      language: 'zh',
      fontScale: 2, // index into FONT_SCALES
      fontScaleTouched: false, // true once the user explicitly picks a font size
      dialect: 'cantonese',
      theme: 'light',
      userApiKey: '',
      userBaseUrl: '',
      userModel: '',
      conversations: [],
      activeId: null,
      sidebarCollapsed: false,

      // ---- transient UI state ----
      drawerOpen: false,
      settingsOpen: false,
      confirm: null, // { kind: 'deleteConv', id } | { kind: 'clearAll' }
      isRecording: false,
      isTranscribing: false,
      isProcessing: false, // true while a chat response is being generated (blocks re-sending)
      speakingId: null,
      toast: null, // { text, tone }
      draftText: '', // interim speech-recognition result held in the input box until the user confirms and sends

      // ---- preference actions ----
      setLanguage: (l) => set({ language: l }),
      setFontScale: (i) => set({ fontScale: i, fontScaleTouched: true }),
      setDialect: (d) => set({ dialect: d, drawerOpen: false }),
      setTheme: (v) => set({ theme: v }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setUserApiKey: (v) => set({ userApiKey: v }),
      setUserBaseUrl: (v) => set({ userBaseUrl: v }),
      setUserModel: (v) => set({ userModel: v }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      setSettingsOpen: (v) => set({ settingsOpen: v }),

      // ---- transient actions ----
      showToast: (text, tone = 'info') => set({ toast: { text, tone } }),
      clearToast: () => set({ toast: null }),
      setRecording: (v) => set({ isRecording: v }),
      setTranscribing: (v) => set({ isTranscribing: v }),
      setProcessing: (v) => set({ isProcessing: v }),
      setSpeakingId: (id) => set({ speakingId: id }),
      setConfirm: (confirm) => set({ confirm }),
      setDraftText: (v) => set({ draftText: v }),

      // ---- conversation actions ----
      newChat: () => {
        const id = uid()
        set((s) => ({
          conversations: [
            { id, title: '', createdAt: now(), messages: [] },
            ...s.conversations,
          ],
          activeId: id,
        }))
      },
      setActive: (id) => set({ activeId: id, drawerOpen: false }),
      addMessage: (convId, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c
            const messages = [...c.messages, msg]
            const title = c.title || (msg.role === 'user' ? titleFrom(msg.text) : c.title)
            return { ...c, messages, title }
          }),
        })),
      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id)
          return {
            conversations,
            activeId: s.activeId === id ? conversations[0]?.id ?? null : s.activeId,
          }
        }),
      clearAll: () => set({ conversations: [], activeId: null }),
    }),
    {
      name: 'dialect-dialogue',
      version: 1,
      migrate: (persisted) => {
        // The in-app dialect selector was removed; the app now defaults to Cantonese.
        // Any previously-persisted non-Cantonese choice is stale and unchangeable from the
        // UI, and TTS only has a Cantonese voice — so force the default back to Cantonese.
        const p = { ...persisted }
        p.dialect = 'cantonese'
        return p
      },
      partialize: (s) => ({
        language: s.language,
        fontScale: s.fontScale,
        fontScaleTouched: s.fontScaleTouched,
        dialect: s.dialect,
        theme: s.theme,
        userApiKey: s.userApiKey,
        userBaseUrl: s.userBaseUrl,
        userModel: s.userModel,
        conversations: s.conversations,
        activeId: s.activeId,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    }
  )
)
