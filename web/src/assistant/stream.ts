// One turn of the model as the server streams it (OpenAI-compatible chat completions, server-sent events): the
// text as it comes, and the tool calls, whose names and arguments arrive in pieces and are put together here.

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface Turn {
  content: string
  toolCalls: ToolCall[]
}

interface Chunk {
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
    }
  }>
  error?: { message?: string } | string
}

/** Puts a turn together from the stream's chunks, one `data:` payload at a time. */
export class TurnBuilder {
  content = ''
  private readonly calls: Array<{ id: string; name: string; arguments: string }> = []

  /** Takes one event's data; returns the text it added (empty when none). */
  add(data: string): string {
    if (data === '[DONE]') return ''
    let chunk: Chunk
    try {
      chunk = JSON.parse(data) as Chunk
    } catch {
      return ''
    }
    if (chunk.error) throw new Error(typeof chunk.error === 'string' ? chunk.error : (chunk.error.message ?? 'The model service failed.'))
    const delta = chunk.choices?.[0]?.delta
    if (!delta) return ''
    for (const piece of delta.tool_calls ?? []) {
      const index = piece.index ?? this.calls.length
      const call = (this.calls[index] ??= { id: '', name: '', arguments: '' })
      if (piece.id) call.id = piece.id
      if (piece.function?.name) call.name += piece.function.name
      if (piece.function?.arguments) call.arguments += piece.function.arguments
    }
    const text = delta.content ?? ''
    this.content += text
    return text
  }

  turn(): Turn {
    return {
      content: this.content,
      toolCalls: this.calls
        .filter((call) => call && call.name)
        .map((call, index) => ({ id: call.id || `call_${index}`, type: 'function', function: { name: call.name, arguments: call.arguments || '{}' } })),
    }
  }
}

/** Splits a server-sent event stream into its `data:` payloads, across chunks that cut lines in two. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data:')) yield line.slice(5).trim()
    }
  }
  if (buffer.startsWith('data:')) yield buffer.slice(5).trim()
}
