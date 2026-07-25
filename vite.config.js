import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// The backend uses HttpOnly cookies for auth. To keep requests same-origin
// (so cookies are sent/stored correctly) we proxy the API route prefixes to
// the FastAPI server during development instead of calling it cross-origin.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8000'

const proxyPrefixes = [
  '/health',
  '/auth',
  '/admin',
  '/hackathons',
  '/submissions',
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
})
