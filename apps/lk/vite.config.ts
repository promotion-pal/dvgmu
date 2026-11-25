import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
const envDir = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '')

  return {
    envDir,
    define: {
      __APP_VERSION__: JSON.stringify(env.VERSION || 'dev'),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
  }
})
