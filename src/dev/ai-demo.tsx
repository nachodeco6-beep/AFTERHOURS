/** Entry of the W3a demo (ai-demo.html). Development only: the build bundles index.html alone. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StudioProvider } from '../components/StudioProvider'
import { AiDemo } from './AiDemo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudioProvider>
      <AiDemo />
    </StudioProvider>
  </StrictMode>,
)
