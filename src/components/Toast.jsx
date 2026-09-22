import { useEffect } from 'react'
import { useStore } from '../store'

export default function Toast() {
  const toast = useStore((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => useStore.getState().clearToast(), 4000)
    return () => clearTimeout(id)
  }, [toast])
  if (!toast) return null
  return (
    <div className={'toast toast-' + toast.tone} role="status" aria-live="assertive">
      {toast.text}
    </div>
  )
}
