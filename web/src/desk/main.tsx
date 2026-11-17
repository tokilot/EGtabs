import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './desk.css'
import { Desk } from './Desk.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desk />
  </StrictMode>,
)
