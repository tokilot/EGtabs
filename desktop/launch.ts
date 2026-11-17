// `npm run desktop`: starts the desktop pet with Electron. Without ELECTRON_RUN_AS_NODE, which editors built on
// Electron (VS Code) pass on to their terminals and which would make Electron run as plain Node.
import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
// In Node, the electron package is the path of its program.
const child = spawn(electron as unknown as string, [import.meta.dirname], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
