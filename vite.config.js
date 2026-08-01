import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

const proxyPrefixes = [
  '/health',
  '/auth',
  '/admin',
  '/hackathons',
  '/submissions',
  '/evaluation-requirements',
  '/ai-evaluation-metric-scoring',
  '/ai-evaluation-prompts',
  '/themes',
]

function apiProxy(target) {
  return {
    target,
    changeOrigin: true,
    secure: false,
    // Full-page navigations (Accept: text/html) must stay with the Vite SPA.
    // Without this, routes like /admin/.../ai-scoring are proxied to FastAPI
    // and return JSON 404 — a blank/white screen in the browser.
    bypass(req) {
      // Browser document navigations must hit the SPA (not FastAPI JSON).
      if (
        req.headers.accept?.includes('text/html') ||
        req.headers['sec-fetch-dest'] === 'document'
      ) {
        return req.url
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_TARGET = env.VITE_API_TARGET || 'http://localhost:8000'

  return {
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      port: 5173,
      proxy: Object.fromEntries(
        proxyPrefixes.map((prefix) => [prefix, apiProxy(API_TARGET)]),
      ),
    },
  }
})
