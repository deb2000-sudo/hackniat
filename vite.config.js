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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv reads .env / .env.[mode] into the config (process.env alone does not).
  const env = loadEnv(mode, process.cwd(), '')
  // Keep requests same-origin in dev so auth cookies work; proxy to local API.
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
        proxyPrefixes.map((prefix) => [
          prefix,
          { target: API_TARGET, changeOrigin: true, secure: false },
        ]),
      ),
    },
  }
})
