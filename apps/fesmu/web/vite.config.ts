import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'

type FeedHandler = (req: IncomingMessage, res: ServerResponse, api: string) => Promise<void>

function calendarFeed(api: string): Plugin {
  const middleware = (load: () => Promise<{ serveCalendar: FeedHandler }>): Connect.NextHandleFunction =>
    (req, res, next) => {
      if (!req.url?.startsWith('/calendar/') || !req.url.split('?')[0].endsWith('/schedule.ics')) return next()
      load().then(module => module.serveCalendar(req, res, api)).catch(next)
    }
  return {
    name: 'schedule-calendar-feed',
    configureServer(server) {
      server.middlewares.use(middleware(async () => {
        const { serveCalendar } = await server.ssrLoadModule('/server/calendar-feed.ts')
        return { serveCalendar }
      }))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    calendarFeed(process.env.CALENDAR_API_URL || loadEnv(mode, process.cwd()).VITE_API_URL || 'http://localhost:18200'),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // The SSR feed shares the portal's generated TypeScript contracts.
  ssr: { noExternal: ['@fesmu/contract'] },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  preview: {
    host: true,
    allowedHosts: ['core.fesmu.ru', 'localhost'],
  },
}))
