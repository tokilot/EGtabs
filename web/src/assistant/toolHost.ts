// Where the assistant's tools run (2026-11-18). The conversation runs where the pet is; the tools need the tab, which
// is in the page with the player. On the page that is the same window (playerHost). The desktop pet's conversation
// runs in its own window; while the practice window is open, the desktop app passes the pet's requests to it
// (remoteHost there, createHostServer here) and they run with its player, as if asked on the page. What a tool
// changed is undone where it was changed: the practice window keeps the undo steps, the pet asks for them by number.
import type { PlayerController } from '../tabs/player/controller.ts'
import type { NoteNames } from '../tabs/player/solfege.ts'
import { systemPrompt } from './prompt.ts'
import { runTool, type ToolResult } from './tools.ts'

export interface ToolHost {
  /** The system message: who the pet is and where the user is now (the open song, speed, loop…). */
  systemPrompt(): Promise<string>
  runTool(name: string, args: string): Promise<ToolResult>
}

/** The tools with this window's player. */
export function playerHost(player: PlayerController): ToolHost {
  return {
    systemPrompt: async () => systemPrompt(player),
    runTool: (name, args) => runTool(name, args, player),
  }
}

/** What the desktop pet asks of the practice window (passed on by desktop/main.ts). */
export type HostRequest =
  | { kind: 'prompt' }
  | { kind: 'tool'; name: string; args: string }
  | { kind: 'undo'; id: number }
  | { kind: 'key'; key: number | null }

/** A tool's result as it goes back to the pet: its undo as a number to ask for. */
interface ToolReply {
  result: string
  ok: boolean
  label?: string
  undo?: number
}

/** What the practice window tells the desktop pet about playback, for performing. */
export interface PlayerView {
  playing: boolean
  noteNames: NoteNames | null
  manualKey: number | null
  transpose: number
}

export function playerView(player: PlayerController): PlayerView {
  const state = player.getSnapshot()
  return { playing: state.playing, noteNames: state.noteNames, manualKey: state.manualKey, transpose: state.transpose }
}

/** Answers the desktop pet's requests with this window's player (the practice window). */
export function createHostServer(player: PlayerController): (request: HostRequest) => Promise<unknown> {
  const undos = new Map<number, NonNullable<ToolResult['undo']>>()
  let next = 1
  return async (request) => {
    switch (request.kind) {
      case 'prompt':
        return { prompt: systemPrompt(player) }
      case 'tool': {
        const result = await runTool(request.name, request.args, player)
        const reply: ToolReply = { result: result.result, ok: result.ok, label: result.label }
        if (result.undo) {
          reply.undo = next++
          undos.set(reply.undo, result.undo)
        }
        return reply
      }
      case 'undo': {
        const undo = undos.get(request.id)
        undos.delete(request.id)
        if (!undo) throw new Error('That change can no longer be undone here.')
        await undo()
        return {}
      }
      case 'key':
        player.setManualKey(request.key)
        return {}
    }
  }
}

/** The tools in the practice window, through the desktop app (`call` sends one request and waits for the answer). */
export function remoteHost(call: (request: HostRequest) => Promise<unknown>): ToolHost {
  return {
    systemPrompt: async () => ((await call({ kind: 'prompt' })) as { prompt: string }).prompt,
    runTool: async (name, args) => {
      try {
        const reply = (await call({ kind: 'tool', name, args })) as ToolReply
        const id = reply.undo
        return {
          result: reply.result,
          ok: reply.ok,
          label: reply.label,
          undo: id === undefined ? undefined : async () => void (await call({ kind: 'undo', id })),
        }
      } catch (error) {
        // The practice window closed meanwhile, or did not answer.
        return { result: `Error: ${(error as Error).message}`, ok: false }
      }
    },
  }
}

/** What the desktop app's practice window lets this page do (desktop/practice.cjs). */
interface DeskHost {
  /** Answers the pet's requests with `handler` until the returned function is called. */
  serve(handler: (request: HostRequest) => Promise<unknown>): () => void
  /** Tells the pet what plays. */
  publish(view: PlayerView): void
}

/** The desktop app's bridge, when this page is its practice window. */
export function deskHost(): DeskHost | undefined {
  return (window as unknown as { deskHost?: DeskHost }).deskHost
}
