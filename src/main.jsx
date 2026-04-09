import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfirmProvider>
      <ToastProvider>
        <BrowserRouter basename="/PACK-MAN">
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ConfirmProvider>
  </StrictMode>,
)
