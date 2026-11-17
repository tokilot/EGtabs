import type { Hono } from 'hono'
import { MAX_CHAT_BYTES, type Assistant } from '../assistant.ts'
import { MAX_PERSONA_BYTES, type Persona } from '../persona.ts'

/**
 * The assistant's model (see assistant.ts): whether there is one, and one turn of the conversation; and the pet's
 * personality, data/assistant.md (persona.ts), as the settings panel reads and saves it.
 */
export function assistantRoutes(app: Hono, assistant: Assistant, persona: Persona) {
  app.get('/api/assistant', (c) => c.json(assistant.status()))

  app.get('/api/assistant/persona', (c) => c.json({ text: persona.read() }))

  app.put('/api/assistant/persona', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { text?: unknown } | null
    if (typeof body?.text !== 'string') return c.json({ error: 'The text is missing.' }, 400)
    if (Buffer.byteLength(body.text) > MAX_PERSONA_BYTES) return c.json({ error: 'The text is too long.' }, 413)
    persona.write(body.text)
    return c.json({ text: persona.read() })
  })

  app.post('/api/assistant/chat', async (c) => {
    const text = await c.req.text()
    if (text.length > MAX_CHAT_BYTES) return c.json({ error: 'The conversation is too long.' }, 413)
    let body: { messages: unknown; tools?: unknown }
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      return c.json({ error: 'The request is not JSON.' }, 400)
    }
    return assistant.chat(body ?? { messages: null }, c.req.raw.signal)
  })
}
