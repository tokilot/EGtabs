// What the practice window lets its page do (web/src/assistant/DeskHostLink.tsx reads window.deskHost): answer the
// desktop pet's requests (its tools, run here with the tab) and tell it what plays. Its being here also tells the
// page that it is the desktop app's practice window, which shows no pet of its own. Plain CommonJS, as preload.cjs.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('deskHost', {
  serve: (handler) => {
    const onRequest = async (_event, { id, request }) => {
      try {
        ipcRenderer.send('host:reply', { id, value: await handler(request) })
      } catch (error) {
        ipcRenderer.send('host:reply', { id, error: String((error && error.message) || error) })
      }
    }
    ipcRenderer.on('host:request', onRequest)
    ipcRenderer.send('host:ready', true)
    return () => {
      ipcRenderer.removeListener('host:request', onRequest)
      ipcRenderer.send('host:ready', false)
    }
  },
  publish: (view) => ipcRenderer.send('host:view', view),
})
