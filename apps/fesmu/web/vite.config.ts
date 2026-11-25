import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig, type ProxyOptions } from 'vite'

const tasksProxyTarget = process.env.TASKS_PROXY_TARGET

function tasksProxy(target: string): Record<string, ProxyOptions> {
  return {
    '^/tasks-api/tasks\\.service\\.': {
      target,
      changeOrigin: true,
      rewrite: (pathname) => pathname.replace('/tasks-api', ''),
      configure(proxy) {
        proxy.on('proxyReq', (request) => {
          request.removeHeader('cookie')
          request.removeHeader('authorization')
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: tasksProxy(tasksProxyTarget ?? 'http://127.0.0.1:4052'),
  },
  preview: {
    host: true,
    allowedHosts: ['core.fesmu.ru', 'localhost'],
    proxy: tasksProxyTarget ? tasksProxy(tasksProxyTarget) : {},
  },
})
