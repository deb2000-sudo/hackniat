import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import App from './App.jsx'
import ThemeProvider from './theme/ThemeProvider.jsx'
import { initLogRocket } from './lib/logrocket'
import AppErrorBoundary from './components/routing/AppErrorBoundary.jsx'

// As early as possible, so the session is recorded from the first paint.
initLogRocket()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
