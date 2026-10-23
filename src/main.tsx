import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/big-shoulders-display/700'
import '@fontsource/big-shoulders-display/900'
import '@fontsource/inter-tight/400'
import '@fontsource/inter-tight/500'
import '@fontsource/inter-tight/600'
import '@fontsource/jetbrains-mono/400'
import '@fontsource/jetbrains-mono/500'
import '@fontsource/instrument-serif/400'
import '@fontsource/instrument-serif/400-italic'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
