if (window.location.pathname === '/oauth/callback') {
  // Move code param from search to hash route
  const params = window.location.search;
  window.location.replace(`/#/oauth/callback${params}`);
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)