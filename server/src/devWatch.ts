// `npm run dev` (2026-11-12): runs dev.ts and starts it again when the server's sources change (src/ and
// ../contracts/, as `node --watch-path` did). It replaces `node --watch-path`, which after a failed start waits for
// the next change: on Windows a start right after a restart can fail for a moment (the old process still holding
// the port, a file in data/tmps/ or user.db), and the server then stayed down. Here a failed start is tried again a
// few times; only a start that keeps failing (a real error in the code) waits for a change.
// Watch only these folders: Vite writes and deletes a temporary file next to vite.config.ts while loading it, and
// watching web/ would restart the server over and over (2026-11-11).
import { spawn, type ChildProcess } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const folders = [here, path.resolve(here, '../../contracts')]
const RETRIES = 3
const RETRY_MS = 1500
/** Several files saved together restart the server once. */
const SETTLE_MS = 200
/** A server that ran this long was started fine; its next failure gets the retries again. */
const HEALTHY_MS = 10_000

let child: ChildProcess | null = null
let restarting = false
let failures = 0
let retry: NodeJS.Timeout | undefined
let settle: NodeJS.Timeout | undefined

function start() {
  clearTimeout(retry)
  const startedAt = Date.now()
  const current = spawn(process.execPath, [path.join(here, 'dev.ts')], { stdio: 'inherit', env: process.env })
  child = current
  current.on('exit', (code, signal) => {
    if (child === current) child = null
    if (restarting) {
      restarting = false
      start()
      return
    }
    if (Date.now() - startedAt > HEALTHY_MS) failures = 0
    failures++
    const why = signal ? `signal ${signal}` : `exit code ${code}`
    if (failures <= RETRIES) {
      console.log(`dev.ts stopped (${why}); starting it again (${failures}/${RETRIES})…`)
      retry = setTimeout(start, RETRY_MS)
    } else {
      console.log(`dev.ts keeps failing (${why}); waiting for a file change before starting it again.`)
    }
  })
}

function restart(file: string) {
  failures = 0
  clearTimeout(retry)
  console.log(`Restarting dev.ts (${file} changed)`)
  if (child) {
    restarting = true
    child.kill()
  } else {
    start()
  }
}

for (const folder of folders) {
  watch(folder, { recursive: true }, (_event, name) => {
    if (!name || !/\.(ts|json)$/.test(name)) return
    clearTimeout(settle)
    settle = setTimeout(() => restart(path.relative(path.resolve(here, '..'), path.join(folder, name))), SETTLE_MS)
  })
}

// The page's build setup too (2026-11-17): Vite keeps alphaTab as it last patched it in memory, so a change to the
// patches (or to the config) only counts after a restart; then reload the page. Only these two files, by name:
// Vite writes and deletes "vite.config.ts.timestamp-….mjs" next to the config on every start (see above).
const web = path.resolve(here, '../../web')
const BUILD_FILES = new Set(['alphatab-patches.ts', 'vite.config.ts'])
watch(web, (_event, name) => {
  if (!name || !BUILD_FILES.has(name)) return
  clearTimeout(settle)
  settle = setTimeout(() => restart(`web/${name}`), SETTLE_MS)
})

// Ctrl+C reaches dev.ts too; once it is gone, so is this.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearTimeout(retry)
    child?.kill()
    process.exit(0)
  })
}

start()
