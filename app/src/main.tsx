import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react/dist/lib/context'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconContext.Provider value={{ color: 'currentColor', size: '1em', weight: 'light', mirrored: false }}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
)
