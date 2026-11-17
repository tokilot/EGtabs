// The app as it is used (2026-11-18): the built page (web/dist, made by `npm run build`) and the API on one port,
// http://127.0.0.1:7273, without Vite. The desktop pet (desktop/) starts this when nothing answers on that port yet.
// dev.ts is the same with Vite serving the page from source; index.ts runs the API on its own.
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { getRequestListener } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createApp } from './app.ts'
import { loadEnvFile } from './env.ts'
import { reportStartup } from './startupReport.ts'

loadEnvFile()

const root = path.resolve(import.meta.dirname, '../..')
const dataDir = path.resolve(process.env.TABS_DATA_DIR ?? path.join(root, 'data'))
const port = Number(process.env.TABS_APP_PORT ?? 7273)
const site = path.join(root, 'web', 'dist')

if (!existsSync(path.join(site, 'index.html'))) {
  console.error(`The page has not been built (${site} is missing): run "npm run build" first.`)
  process.exit(1)
}

const { app, ready } = createApp({ dataDir, atStartup: true })
reportStartup(await ready)

// The page's files as built; the page routes by the hash, so every page is index.html (or the desktop pet's desk.html).
const pages = new Hono()
pages.use('*', serveStatic({ root: path.relative(process.cwd(), site) || '.' }))
pages.get('*', serveStatic({ path: path.relative(process.cwd(), path.join(site, 'index.html')) }))

const api = getRequestListener(app.fetch)
const files = getRequestListener(pages.fetch)
const http = createServer((request, response) => {
  if (request.url?.startsWith('/api/')) void api(request, response)
  else void files(request, response)
})

// Local only: this is a single-user tool and the API has no authentication.
http.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EADDRINUSE') throw error
  console.error(`Port ${port} is already in use: is "npm run dev" or another copy running? Stop it, or set TABS_APP_PORT.`)
  process.exit(1)
})
http.listen(port, '127.0.0.1', () => {
  console.log(`Page and API on http://127.0.0.1:${port} (data in ${dataDir})`)
})
