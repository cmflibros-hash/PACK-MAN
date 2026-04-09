import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const closeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const value = useMemo(() => ({ showToast, closeToast }), [showToast, closeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-16 right-4 z-[80] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`rounded-lg border px-4 py-3 shadow-lg transition-all ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm leading-5">{toast.message}</p>
              <button
                type="button"
                onClick={() => closeToast(toast.id)}
                className="text-base leading-none opacity-70 hover:opacity-100"
                aria-label="Cerrar notificación"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
