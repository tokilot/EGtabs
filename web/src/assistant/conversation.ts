// The assistant's conversation (2026-11-12): one at a time, kept while the page is open. A message goes to the
// model with the tools; the model answers with text, tool calls, or both; the tools run here and their results go
// back, until the model answers without calling any (or the steps run out, or the user stops it).
import { useSyncExternalStore } from 'react'
import type { AssistantStatus } from '../../../contracts/assistant.ts'
import { request } from '../shared/http.ts'
import { translate } from '../shared/ui/i18n.ts'
import { sseData, TurnBuilder, type ChatMessage, type Turn } from './stream.ts'
import type { ToolHost } from './toolHost.ts'
import { toolDefinitions } from './tools.ts'

/** How the pet looks: waiting, waiting for the model, the model's text coming in, tools running, something failed. */
export type Mood = 'idle' | 'thinking' | 'talking' | 'working' | 'error'

export interface Action {
  label: string
  ok: boolean
}

export interface AssistantState {
  /** The server's model; null until asked. */
  status: AssistantStatus | null
  mood: Mood
  busy: boolean
  /** What the user asked last. */
  question: string
  /** The model's text for that question, as it comes in. */
  reply: string
  /** What the tools changed for that question, in order. */
  actions: Action[]
  /** What that answer changed can be put back (tones, a track's tone), all at once. */
  undoable: boolean
  /** It was put back. */
  undone: boolean
  error: string | null
}

/** Model turns per question: enough to read some bars and change a few things, not to run away. */
export const MAX_STEPS = 12
/** Messages kept for the model; older ones are dropped from the start (at a question, so no tool result is orphaned). */
const MAX_HISTORY = 60

let state: AssistantState = { status: null, mood: 'idle', busy: false, question: '', reply: '', actions: [], undoable: false, undone: false, error: null }
let history: ChatMessage[] = []
/** How to put back what the last answer changed, in the order it was changed. */
let undoSteps: Array<() => void | Promise<void>> = []
/** Told to the model with the next question: what the user did meanwhile (put an answer's changes back). */
let notes: string[] = []
let running: AbortController | null = null
const listeners = new Set<() => void>()

function set(changes: Partial<AssistantState>) {
  state = { ...state, ...changes }
  for (const listener of listeners) listener()
}

export function useAssistant(): AssistantState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => state,
  )
}

export function assistantState(): AssistantState {
  return state
}

/** Asks the server whether a model is configured (once; again with `force`). */
export async function loadStatus(force = false) {
  if (state.status && !force) return
  try {
    set({ status: await request<AssistantStatus>('/api/assistant') })
  } catch (error) {
    set({ status: { ready: false, model: '', problem: (error as Error).message } })
  }
}

function trimHistory() {
  if (history.length <= MAX_HISTORY) return
  let start = history.length - MAX_HISTORY
  while (start < history.length && history[start].role !== 'user') start++
  history = history.slice(start)
}

/** One model turn: the text is passed on as it comes (`onText`), the tool calls when the turn is complete. */
async function modelTurn(messages: ChatMessage[], signal: AbortSignal, onText: (text: string) => void): Promise<Turn> {
  let response: Response
  try {
    response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, tools: toolDefinitions() }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error(translate('无法连接本地服务，请确认后端已启动。'))
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? translate('请求失败：{status}', { status: response.status }))
  }
  const builder = new TurnBuilder()
  for await (const data of sseData(response.body)) {
    const text = builder.add(data)
    if (text) onText(text)
  }
  return builder.turn()
}

/** Asks the assistant, its tools run by `host` (where the tab is); does nothing while it is still answering. */
export async function ask(question: string, host: ToolHost) {
  const text = question.trim()
  if (!text || state.busy) return
  const controller = new AbortController()
  running = controller
  history.push({ role: 'user', content: notes.length > 0 ? `(${notes.join(' ')})\n\n${text}` : text })
  notes = []
  trimHistory()
  undoSteps = []
  set({ busy: true, mood: 'thinking', question: text, reply: '', actions: [], undoable: false, undone: false, error: null })
  let partial = ''
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      partial = ''
      // Between turns the text so far stays; a new turn starts on a new paragraph.
      const before = state.reply && !state.reply.endsWith('\n') ? `${state.reply}\n\n` : state.reply
      const turn = await modelTurn([{ role: 'system', content: await host.systemPrompt() }, ...history], controller.signal, (piece) => {
        partial += piece
        set({ mood: 'talking', reply: before + partial })
      })
      partial = ''
      history.push(turn.toolCalls.length > 0 ? { role: 'assistant', content: turn.content || null, tool_calls: turn.toolCalls } : { role: 'assistant', content: turn.content })
      if (turn.toolCalls.length === 0) {
        set({ mood: 'idle' })
        return
      }
      set({ mood: 'working' })
      const actions = [...state.actions]
      for (const call of turn.toolCalls) {
        const result = await host.runTool(call.function.name, call.function.arguments)
        if (result.undo) undoSteps.push(result.undo)
        history.push({ role: 'tool', tool_call_id: call.id, content: result.result })
        if (result.label) actions.push({ label: result.label, ok: result.ok })
        else if (!result.ok) console.warn(`assistant tool ${call.function.name}:`, result.result)
      }
      set({ actions, undoable: undoSteps.length > 0, mood: 'thinking' })
    }
    set({ mood: 'idle', reply: `${state.reply}${state.reply ? '\n\n' : ''}${translate('bpm太快，助手弹不过来了')}` })
  } catch (error) {
    // What the model had said before it was cut off stays in the conversation.
    if (partial) history.push({ role: 'assistant', content: partial })
    if (controller.signal.aborted) set({ mood: 'idle', reply: `${state.reply}${state.reply ? ' ' : ''}${translate('（已停止）')}` })
    else set({ mood: 'error', error: (error as Error).message })
  } finally {
    if (running === controller) running = null
    set({ busy: false })
  }
}

/** Stops the answer under way (the model's stream; tools that already ran stay done). */
export function stop() {
  running?.abort()
}

/** Forgets the conversation. */
export function newConversation() {
  stop()
  history = []
  undoSteps = []
  notes = []
  set({ mood: 'idle', question: '', reply: '', actions: [], undoable: false, undone: false, error: null })
}

/** Puts back everything the last answer changed, last change first; the model hears of it with the next question. */
export async function undoAnswer() {
  if (state.busy || !state.undoable || state.undone) return
  const steps = undoSteps.reverse()
  undoSteps = []
  set({ undoable: false })
  try {
    for (const step of steps) await step()
    notes.push('The user undid every change of your last answer.')
    set({ undone: true })
  } catch (error) {
    set({ error: (error as Error).message })
  }
}
