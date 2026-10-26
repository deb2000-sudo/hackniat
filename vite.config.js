import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * The release tag LogRocket stamps on every session: VITE_APP_RELEASE when the
 * build pipeline sets one, else the current git commit, else the package version.
 */
function appRelease(env) {
  if (env.VITE_APP_RELEASE) return env.VITE_APP_RELEASE
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version
  }
}

const proxyPrefixes = [
  '/health',
  '/auth',
  '/super-admin',
  '/admin',
  '/hackathons',
  '/submissions',
  '/evaluation-requirements',
  '/ai-evaluation-metric-scoring',
  '/ai-evaluation-prompts',
  '/themes',
  '/universities',
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
    define: {
      __APP_RELEASE__: JSON.stringify(appRelease(env)),
    },
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      // Firebase Phone Auth rejects localhost — bind 127.0.0.1 for local dev.
      host: '127.0.0.1',
      port: 5173,
      proxy: Object.fromEntries(
        proxyPrefixes.map((prefix) => [prefix, apiProxy(API_TARGET)]),
      ),
    },
  }
})
