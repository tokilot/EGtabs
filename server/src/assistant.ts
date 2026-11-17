import type { AssistantStatus } from '../../contracts/assistant.ts'
import type { AssistantSetup } from './env.ts'
import { withPersona } from './persona.ts'

export type { AssistantStatus }

/**
 * The model the assistant talks to (2026-11-12): any service with an OpenAI-compatible chat completions endpoint
 * (an online one or one on this machine, like Ollama or LM Studio). The key stays here: the page sends the
 * conversation and its tools to /api/assistant/chat, the server adds the model and the key and streams the answer
 * back as it comes. The tools run in the page, where the tab is. Which service and model: TABS_AI_BASE_URL,
 * TABS_AI_MODEL and TABS_AI_API_KEY in .env.local (env.ts), read again for every request.
 */
export interface AssistantConfig {
  /** e.g. https://api.deepseek.com or http://127.0.0.1:11434/v1; "/chat/completions" is added. */
  baseUrl: string
  /** Empty for a service that needs none. */
  apiKey: string
  model: string
  /**
   * false: ask for the whole answer at once and pass it on as one piece of the stream (TABS_AI_STREAM=false), for
   * services whose streaming loses parts of the answer (2026-11-18: a relay that dropped the start of every answer).
   */
  stream?: boolean
}

/** Tries at connecting to the service: a connection reset before any answer is tried again (flaky networks). */
const CONNECT_TRIES = 6
const RETRY_DELAY_MS = 300

export class AssistantError extends Error {
  readonly status: 400 | 502 | 503
  constructor(message: string, status: 400 | 502 | 503) {
    super(message)
    this.status = status
  }
}

/** The most the page may send at once: a long conversation with some bars of tab in it, not whole files. */
export const MAX_CHAT_BYTES = 2 * 1024 * 1024

export class Assistant {
  private readonly setup: () => AssistantSetup
  private readonly fetch: typeof fetch
  /** The user's notes on the pet (data/assistant.md), added to the system message. */
  private readonly persona: () => string

  constructor(setup: () => AssistantSetup, fetcher: typeof fetch = fetch, persona: () => string = () => '') {
    this.setup = setup
    this.fetch = fetcher
    this.persona = persona
  }

  status(): AssistantStatus {
    const setup = this.setup()
    return 'problem' in setup ? { ready: false, model: '', problem: setup.problem } : { ready: true, model: setup.config.model }
  }

  /**
   * One turn of the model: the conversation and the tools go up, the answer comes back as the service streams it
   * (server-sent events, passed on as they are). Stopped when `signal` aborts (the page stopped it or went away).
   */
  async chat(body: { messages: unknown; tools?: unknown }, signal?: AbortSignal): Promise<Response> {
    const setup = this.setup()
    if ('problem' in setup) throw new AssistantError(setup.problem, 503)
    const config = { ...setup.config, baseUrl: setup.config.baseUrl.trim().replace(/\/+$/, '') }
    if (!Array.isArray(body.messages) || body.messages.length === 0) throw new AssistantError('No messages.', 400)
    if (body.tools !== undefined && !Array.isArray(body.tools)) throw new AssistantError('The tools must be a list.', 400)
    const stream = config.stream !== false
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: stream ? 'text/event-stream' : 'application/json' }
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
    const request = JSON.stringify({
      model: config.model,
      messages: withPersona(body.messages, this.persona()),
      ...(Array.isArray(body.tools) && body.tools.length > 0 ? { tools: body.tools } : {}),
      stream,
    })
    let response: Response | null = null
    for (let tries = 1; !response; tries++) {
      try {
        response = await this.fetch(`${config.baseUrl}/chat/completions`, { method: 'POST', headers, body: request, signal })
      } catch (error) {
        if (signal?.aborted) throw error
        // No answer came: the connection failed (reset, refused, timed out); a moment later it often works.
        if (tries < CONNECT_TRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * tries))
          continue
        }
        throw new AssistantError(`Cannot reach the model service: ${causes(error)}`, 502)
      }
    }
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '')
      throw new AssistantError(`The model service answered ${response.status}: ${upstreamMessage(text)}`, 502)
    }
    const events = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' }
    if (stream) return new Response(response.body, { headers: events })
    return new Response(asStream(await response.text()), { headers: events })
  }
}

/** A whole answer (stream: false) as the stream the page reads: one piece with all of its text and tool calls. */
export function asStream(text: string): string {
  let answer: { choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }> } }> }
  try {
    answer = JSON.parse(text) as typeof answer
  } catch {
    throw new AssistantError(`The model service answered with something that is not JSON: ${text.slice(0, 200) || 'nothing'}`, 502)
  }
  const message = answer.choices?.[0]?.message
  if (!message) throw new AssistantError(`The model service answered without a message: ${upstreamMessage(text)}`, 502)
  const delta = {
    content: message.content ?? '',
    tool_calls: (message.tool_calls ?? []).map((call, index) => ({ index, id: call.id, type: call.type ?? 'function', function: call.function })),
  }
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`
}

/** An error and what caused it ("fetch failed" says little; its cause says "read ECONNRESET"). */
function causes(error: unknown): string {
  const parts: string[] = []
  for (let current = error as { message?: string; code?: string; cause?: unknown } | undefined; current && parts.length < 4; current = current.cause as typeof current) {
    parts.push(current.code && !current.message?.includes(current.code) ? `${current.message} (${current.code})` : (current.message ?? String(current)))
  }
  return parts.join(': ')
}

/** The service's own error message when it sends one ({"error": {"message": …}}), else the start of its answer. */
function upstreamMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    const message = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? parsed.message)
    if (message) return message.slice(0, 300)
  } catch {
    // not JSON
  }
  return text.slice(0, 300) || 'no details'
}
