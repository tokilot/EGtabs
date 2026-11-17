// The desktop pet (2026-11-18): the assistant in a small see-through window on top of the desktop and of the practice
// window, there until the app quits: the way into practising. A click on the pet shows its buttons (settings, chat,
// perform, practise), a double click or "practise" opens the app's page in a window of its own (the practice window,
// which shows no pet of its own), a drag moves it, a right click has the menu: open the page, go on with the last
// song, start with Windows (off unless chosen), a desktop shortcut, quit. The pet's conversation runs in its window;
// while the practice window is open, its tools run there, with the tab: this passes the requests across
// (desk:call → host:request → host:reply) and what plays back to the pet (host:view → desk:view). The practice
// window's page gets desktop/practice.cjs for that.
// The page and the API come from the app's server on http://127.0.0.1:7273: one already running there ("npm run dev"
// or "npm start") is used; otherwise this starts server/src/serve.ts (the built page, `npm run build`) with Electron's
// own Node, and stops it on quit. The pet's window loads web/desk.html; desktop/preload.cjs connects the two.
// Where the pet was put is kept in data/desktop.json.
import electron from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, screen, shell } = electron
type Window = electron.BrowserWindow

const root = path.resolve(import.meta.dirname, '..')
// The settings in .env.local, as the server reads them (values already in the environment win).
const envFile = path.resolve(process.env.TABS_ENV_FILE ?? path.join(root, '.env.local'))
if (existsSync(envFile)) process.loadEnvFile(envFile)
const dataDir = path.resolve(process.env.TABS_DATA_DIR ?? path.join(root, 'data'))
const port = Number(process.env.TABS_APP_PORT ?? 7273)
const base = `http://127.0.0.1:${port}`
const stateFile = path.join(dataDir, 'desktop.json')
const logFile = path.join(dataDir, 'desktop.log')
/** The pet's picture: her part of the 16:9 frame (see web/src/assistant/Pet.module.css). */
const picture = path.join(root, 'web', 'src', 'assistant', 'pet', 'idle.png')
const PICTURE_CROP = { x: 296, y: 64, width: 412, height: 437 }

/** The pet's window: room for the bubble or the settings over the pet, and the input box under it. */
const PET_SIZE = { width: 420, height: 600 }

const ZH = {
  practise: '打开练琴页',
  resume: '接着练上次那首',
  login: '开机自启',
  shortcut: '在桌面创建快捷方式',
  shortcutMade: '已在桌面创建快捷方式「EGtabs」。',
  quit: '退出',
  noServer: '后端没有启动起来',
}
const EN: typeof ZH = {
  practise: 'Open the practice page',
  resume: 'Go on with the last song',
  login: 'Start with Windows',
  shortcut: 'Make a desktop shortcut',
  shortcutMade: 'A shortcut "EGtabs" is on the desktop.',
  quit: 'Quit',
  noServer: 'The backend did not start',
}
/** The menu's words, in the system's language (known once the app is ready). */
const text = () => (app.getLocale().startsWith('zh') ? ZH : EN)

let pet: Window | null = null
let practice: Window | null = null
let server: ChildProcess | null = null
/** The practice window's page is serving the pet's requests (it said so: host:ready). */
let hostReady = false
/** Requests sent to the practice window and not answered yet. */
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()
let nextRequest = 1
/** How long the pet waits for the practice window to answer a request (a tool reading many bars is quick). */
const REQUEST_TIMEOUT_MS = 60_000

// ---- what is kept between runs ----

interface DeskState {
  x?: number
  y?: number
}

function readState(): DeskState {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8')) as DeskState
  } catch {
    return {}
  }
}

function writeState(state: DeskState) {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`)
}

function log(text: string) {
  try {
    mkdirSync(dataDir, { recursive: true })
    appendFileSync(logFile, text)
  } catch {
    // no log then
  }
}

// ---- the server ----

async function answering(): Promise<boolean> {
  try {
    return (await fetch(`${base}/api/assistant`)).ok
  } catch {
    return false
  }
}

/** The app's server: the one running on the port, or one started here (null when it would not start: why). */
async function ensureServer(): Promise<string | null> {
  if (await answering()) return null
  let output = ''
  server = spawn(process.execPath, [path.join(root, 'server', 'src', 'serve.ts')], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  log(`\n--- ${new Date().toISOString()} server started\n`)
  const keep = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-4000)
    log(chunk.toString())
  }
  server.stdout?.on('data', keep)
  server.stderr?.on('data', keep)
  let exited = false
  server.on('exit', () => {
    exited = true
    server = null
  })
  for (let waited = 0; waited < 60_000 && !exited; waited += 250) {
    if (await answering()) return null
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return output.trim() || `No answer on ${base}.`
}

function stopServer() {
  const child = server
  server = null
  if (!child?.pid) return
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  else child.kill()
}

// ---- the windows ----

function icon(): electron.NativeImage {
  const image = nativeImage.createFromPath(picture)
  return image.isEmpty() ? image : image.crop(PICTURE_CROP).resize({ width: 256 })
}

/** Where the pet goes: where it was left, if that is still on a screen; else the bottom right of the main screen. */
function petPosition(): { x: number; y: number } {
  const saved = readState()
  if (saved.x !== undefined && saved.y !== undefined) {
    const middle = { x: saved.x + PET_SIZE.width / 2, y: saved.y + PET_SIZE.height - 40 }
    const on = screen.getAllDisplays().some(({ workArea: area }) => middle.x >= area.x && middle.x < area.x + area.width && middle.y >= area.y && middle.y < area.y + area.height)
    if (on) return { x: saved.x, y: saved.y }
  }
  const area = screen.getPrimaryDisplay().workArea
  return { x: area.x + area.width - PET_SIZE.width - 24, y: area.y + area.height - PET_SIZE.height }
}

function createPet() {
  const at = petPosition()
  pet = new BrowserWindow({
    ...at,
    ...PET_SIZE,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    title: 'EGtabs',
    icon: icon(),
    webPreferences: { preload: path.join(import.meta.dirname, 'preload.cjs') },
  })
  // Clicks go through until the page says the pointer is on the pet (preload: setSolid).
  pet.setIgnoreMouseEvents(true, { forward: true })
  void pet.loadURL(`${base}/desk.html`)
  pet.once('ready-to-show', () => pet?.showInactive())
  pet.on('closed', () => {
    pet = null
  })
}

/** The last song opened, for "go on with the last song". */
async function lastSongHash(): Promise<string> {
  try {
    const songs = (await (await fetch(`${base}/api/songs`)).json()) as Array<{ id: number; lastOpenedAt: string | null }>
    const last = songs.filter((song) => song.lastOpenedAt).sort((a, b) => b.lastOpenedAt!.localeCompare(a.lastOpenedAt!))[0]
    return last ? `#/song/${last.id}` : ''
  } catch {
    return ''
  }
}

async function openPractice(resume = false) {
  const hash = resume ? await lastSongHash() : ''
  if (practice) {
    if (hash) void practice.loadURL(`${base}/${hash}`)
    if (practice.isMinimized()) practice.restore()
    practice.show()
    practice.focus()
    return
  }
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 480,
    autoHideMenuBar: true,
    show: false,
    title: 'EGtabs',
    icon: icon(),
    webPreferences: { preload: path.join(import.meta.dirname, 'practice.cjs') },
  })
  practice = window
  // Links out of the app (online tabs, licences) open in the browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  void window.loadURL(`${base}/${hash}`)
  window.once('ready-to-show', () => window.show())
  // A page loaded anew serves again once it says so.
  window.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) setHostReady(false)
  })
  window.on('closed', () => {
    practice = null
    setHostReady(false)
  })
}

/** The practice window serves the pet's requests, or no longer does: the pet hears of it; open requests fail. */
function setHostReady(ready: boolean) {
  if (!ready) {
    for (const [id, request] of pending) {
      clearTimeout(request.timer)
      request.reject(new Error('The practice window was closed.'))
      pending.delete(id)
    }
  }
  if (ready === hostReady) return
  hostReady = ready
  pet?.webContents.send('desk:practice', ready)
}

// ---- the menu ----

function loginItem(): electron.Settings {
  return { path: process.execPath, args: [app.getAppPath()] }
}

/** A Windows icon file holding the pet's picture (an .ico may hold a PNG), for the shortcut. */
function iconFile(): string | undefined {
  const png = icon().toPNG()
  if (png.length === 0) return undefined
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  // 0 means 256 pixels wide and high.
  header.writeUInt8(0, 6)
  header.writeUInt8(0, 7)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(png.length, 16)
  header.writeUInt32LE(22, 20)
  const file = path.join(dataDir, 'desktop.ico')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(file, Buffer.concat([header, png]))
  return file
}

function makeShortcut() {
  const file = path.join(app.getPath('desktop'), 'EGtabs.lnk')
  const made = shell.writeShortcutLink(file, existsSync(file) ? 'replace' : 'create', {
    target: process.execPath,
    args: `"${app.getAppPath()}"`,
    description: 'EGtabs',
    icon: iconFile(),
    iconIndex: 0,
  })
  if (made) void dialog.showMessageBox({ message: text().shortcutMade, icon: icon() })
}

function showMenu() {
  const items: electron.MenuItemConstructorOptions[] = [
    { label: text().practise, click: () => void openPractice() },
    { label: text().resume, click: () => void openPractice(true) },
    { type: 'separator' },
    {
      label: text().login,
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItem()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItem(), openAtLogin: item.checked }),
    },
  ]
  if (process.platform === 'win32') items.push({ label: text().shortcut, click: makeShortcut })
  items.push({ type: 'separator' }, { label: text().quit, click: () => app.quit() })
  Menu.buildFromTemplate(items).popup({ window: pet ?? undefined })
}

// ---- what the pet's page asks for (preload.cjs) ----

ipcMain.on('desk:solid', (event, solid: boolean) => {
  BrowserWindow.fromWebContents(event.sender)?.setIgnoreMouseEvents(!solid, { forward: true })
})
ipcMain.on('desk:move-by', (event, dx: number, dy: number) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || !Number.isFinite(dx) || !Number.isFinite(dy)) return
  const [x, y] = window.getPosition()
  window.setBounds({ x: x + Math.round(dx), y: y + Math.round(dy), ...PET_SIZE })
})
ipcMain.on('desk:drag-end', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return
  const [x, y] = window.getPosition()
  writeState({ ...readState(), x, y })
})
ipcMain.on('desk:open-practice', () => void openPractice())
ipcMain.on('desk:menu', () => showMenu())

// ---- the pet's requests to the practice window, and what it plays (practice.cjs) ----

ipcMain.handle('desk:practice-open', () => hostReady)
ipcMain.handle('desk:call', (_event, request: unknown) => {
  const window = practice
  if (!window || !hostReady) return Promise.reject(new Error('The practice window is not open.'))
  const id = nextRequest++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('The practice window did not answer.'))
    }, REQUEST_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    window.webContents.send('host:request', { id, request })
  })
})
const fromPractice = (event: electron.IpcMainEvent) => practice !== null && event.sender === practice.webContents
ipcMain.on('host:ready', (event, ready: boolean) => {
  if (fromPractice(event)) setHostReady(Boolean(ready))
})
ipcMain.on('host:reply', (event, reply: { id: number; value?: unknown; error?: string }) => {
  const request = fromPractice(event) ? pending.get(reply.id) : undefined
  if (!request) return
  pending.delete(reply.id)
  clearTimeout(request.timer)
  if (reply.error !== undefined) request.reject(new Error(reply.error))
  else request.resolve(reply.value)
})
ipcMain.on('host:view', (event, view: unknown) => {
  if (fromPractice(event)) pet?.webContents.send('desk:view', view)
})

// ---- starting and stopping ----

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Started again (the shortcut, while it runs): the practice page.
  app.on('second-instance', () => void openPractice())
  // The pet stays when the practice window closes; only "quit" ends the app.
  app.on('window-all-closed', () => undefined)
  app.on('will-quit', stopServer)
  void app.whenReady().then(async () => {
    const problem = await ensureServer()
    if (problem !== null) {
      dialog.showErrorBox(text().noServer, `${problem}\n\n(${logFile})`)
      stopServer()
      app.quit()
      return
    }
    createPet()
  })
}
