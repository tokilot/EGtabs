// What the desktop pet's window lets its page do (web/src/desk/Desk.tsx reads window.desk): let clicks through or
// take them, move the window while the pet is dragged, open the practice page, show the menu; and talk to the
// practice window, where the pet's tools run while it is open (web/src/assistant/toolHost.ts). Plain CommonJS:
// preload scripts of sandboxed windows are not modules.
const { contextBridge, ipcRenderer } = require('electron')

/** Listens to a message from the main process; returns the unsubscribe. */
function listen(channel, listener) {
  const handler = (_event, value) => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('desk', {
  setSolid: (solid) => ipcRenderer.send('desk:solid', Boolean(solid)),
  moveBy: (dx, dy) => ipcRenderer.send('desk:move-by', Number(dx), Number(dy)),
  dragEnd: () => ipcRenderer.send('desk:drag-end'),
  openPractice: () => ipcRenderer.send('desk:open-practice'),
  showMenu: () => ipcRenderer.send('desk:menu'),
  practiceOpen: () => ipcRenderer.invoke('desk:practice-open'),
  onPractice: (listener) => listen('desk:practice', listener),
  onView: (listener) => listen('desk:view', listener),
  call: (request) => ipcRenderer.invoke('desk:call', request),
})
