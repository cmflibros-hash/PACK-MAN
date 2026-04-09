import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    onConfirm: null,
    onCancel: null
  })

  const ask = useCallback(({ title, message, confirmText = 'Eliminar', cancelText = 'Cancelar' }) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: title || 'Confirmar acción',
        message: message || '¿Estás seguro de continuar?',
        confirmText,
        cancelText,
        onConfirm: () => {
          resolve(true)
          setState(prev => ({ ...prev, open: false }))
        },
        onCancel: () => {
          resolve(false)
          setState(prev => ({ ...prev, open: false }))
        }
      })
    })
  }, [])

  const value = useMemo(() => ({ ask }), [ask])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">{state.title}</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">{state.message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={state.onCancel}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                onClick={state.onConfirm}
                className="rounded-md bg-[#00863a] px-4 py-2 text-sm text-white hover:bg-[#006d2e]"
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return ctx
}
