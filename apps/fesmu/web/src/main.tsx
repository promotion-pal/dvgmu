import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Toaster } from './shared/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      {/* Every toast() in the app renders here; without it they were silent. */}
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  </StrictMode>,
)
