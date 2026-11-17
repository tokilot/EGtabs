import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import type { AssistantConfig } from './assistant.ts'
import { assistantSetup, currentEnv } from './env.ts'
import { PERSONA_TEMPLATE } from './persona.ts'

let dataDir: string
let close: (() => void) | null = null
beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'tabs-assistant-'))
})
afterEach(() => {
  close?.()
  close = null
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 5 })
})

function setup(config: AssistantConfig | string, fetcher?: typeof fetch) {
  const assistant = { setup: () => (typeof config === 'string' ? { problem: config } : { config }), fetch: fetcher }
  const { app, library } = createApp({ dataDir, assistant })
  close = () => library.close()
  return app
}

const chat = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('the assistant route', () => {
  it('says whether a model is configured', async () => {
    const none = setup('No provider is picked.')
    expect(await (await none.request('/api/assistant')).json()).toEqual({ ready: false, model: '', problem: 'No provider is picked.' })
    const response = await none.request('/api/assistant/chat', chat({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(response.status).toBe(503)
    expect(((await response.json()) as { error: string }).error).toBe('No provider is picked.')
  })

  it('passes the conversation on with the model and the key, and streams the answer back', async () => {
    let sent: { url: string; init: RequestInit } | null = null
    const stream = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n'
    const app = setup({ baseUrl: 'https://models.example/v1/', apiKey: 'secret', model: 'some-model' }, (async (url: string, init: RequestInit) => {
      sent = { url, init }
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }) as typeof fetch)
    expect(await (await app.request('/api/assistant')).json()).toEqual({ ready: true, model: 'some-model' })
    const tools = [{ type: 'function', function: { name: 'read_bars', parameters: { type: 'object' } } }]
    const response = await app.request('/api/assistant/chat', chat({ messages: [{ role: 'user', content: 'hi' }], tools }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    expect(await response.text()).toBe(stream)
    expect(sent!.url).toBe('https://models.example/v1/chat/completions')
    expect((sent!.init.headers as Record<string, string>).Authorization).toBe('Bearer secret')
    expect(JSON.parse(sent!.init.body as string)).toEqual({ model: 'some-model', messages: [{ role: 'user', content: 'hi' }], tools, stream: true })
  })

  it('sends no key to a service that needs none, and passes on the service error', async () => {
    let headers: Record<string, string> = {}
    const app = setup({ baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'local' }, (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>
      return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })
    }) as typeof fetch)
    const response = await app.request('/api/assistant/chat', chat({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(headers.Authorization).toBeUndefined()
    expect(response.status).toBe(502)
    expect(((await response.json()) as { error: string }).error).toBe('The model service answered 404: model not found')
  })

  it('tries again when the connection is reset before any answer, and says why when it keeps failing', async () => {
    const reset = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) })
    let calls = 0
    const flaky = setup({ baseUrl: 'http://x', apiKey: '', model: 'm' }, (async () => {
      calls++
      if (calls < 3) throw reset()
      return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    }) as unknown as typeof fetch)
    const answered = await flaky.request('/api/assistant/chat', chat({ messages: [{ role: 'user', content: 'hi' }] }))
    expect([answered.status, calls]).toEqual([200, 3])
    close?.()
    const down = setup({ baseUrl: 'http://x', apiKey: '', model: 'm' }, (async () => {
      throw reset()
    }) as unknown as typeof fetch)
    const failed = await down.request('/api/assistant/chat', chat({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(failed.status).toBe(502)
    expect(((await failed.json()) as { error: string }).error).toBe('Cannot reach the model service: fetch failed: read ECONNRESET')
  })

  it('asks for whole answers when streaming is off, and passes them on as one piece of the stream', async () => {
    let sent: Record<string, unknown> = {}
    const whole = { choices: [{ message: { role: 'assistant', content: '你好！', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'set_speed', arguments: '{"percent":70}' } }] } }] }
    const app = setup({ baseUrl: 'http://x', apiKey: '', model: 'm', stream: false }, (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string) as Record<string, unknown>
      return new Response(JSON.stringify(whole), { headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch)
    const response = await app.request('/api/assistant/chat', chat({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(sent.stream).toBe(false)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    const events = (await response.text()).split('\n\n').filter(Boolean)
    expect(events[1]).toBe('data: [DONE]')
    expect(JSON.parse(events[0].slice(5))).toEqual({
      choices: [{ delta: { content: '你好！', tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'set_speed', arguments: '{"percent":70}' } }] } }],
    })
  })

  it('turns away a request without messages', async () => {
    const app = setup({ baseUrl: 'http://x', apiKey: '', model: 'm' }, (async () => new Response('')) as unknown as typeof fetch)
    expect((await app.request('/api/assistant/chat', chat({ messages: [] }))).status).toBe(400)
    expect((await app.request('/api/assistant/chat', { method: 'POST', body: 'nope' })).status).toBe(400)
  })
})

describe('the settings in .env.local', () => {
  const file = () => path.join(dataDir, '.env.local')

  it('give the assistant its model, with a key or without one', () => {
    expect(assistantSetup({ TABS_AI_BASE_URL: 'https://api.deepseek.com ', TABS_AI_MODEL: 'deepseek-chat', TABS_AI_API_KEY: ' sk-1' })).toEqual({
      config: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'sk-1' },
    })
    expect(assistantSetup({ TABS_AI_BASE_URL: 'http://127.0.0.1:11434/v1', TABS_AI_MODEL: 'qwen3' })).toEqual({
      config: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3', apiKey: '' },
    })
    // Streaming is on unless switched off.
    expect(assistantSetup({ TABS_AI_BASE_URL: 'http://x', TABS_AI_MODEL: 'm', TABS_AI_STREAM: 'false' })).toEqual({ config: { baseUrl: 'http://x', model: 'm', apiKey: '', stream: false } })
    expect(assistantSetup({ TABS_AI_BASE_URL: 'http://x', TABS_AI_MODEL: 'm', TABS_AI_STREAM: 'true' })).toEqual({ config: { baseUrl: 'http://x', model: 'm', apiKey: '' } })
  })

  it('say what is missing', () => {
    for (const env of [{}, { TABS_AI_BASE_URL: 'https://api.deepseek.com' }, { TABS_AI_BASE_URL: ' ', TABS_AI_MODEL: 'm' }]) {
      expect((assistantSetup(env) as { problem: string }).problem).toContain('Set TABS_AI_BASE_URL and TABS_AI_MODEL in .env.local')
    }
  })

  it('are read from the file as it is now, comments left out, under the system environment', () => {
    expect(currentEnv(file()).TABS_TEST_SETTING).toBeUndefined()
    writeFileSync(file(), '# a comment\nTABS_TEST_SETTING=one # the first\nPATH=from-the-file\n')
    const env = currentEnv(file())
    expect(env.TABS_TEST_SETTING).toBe('one')
    expect(env.PATH).toBe(process.env.PATH)
    writeFileSync(file(), 'TABS_TEST_SETTING="two words"\n')
    expect(currentEnv(file()).TABS_TEST_SETTING).toBe('two words')
  })
})

describe("the pet's personality, data/assistant.md", () => {
  it('is made from the template on the first start, and read and saved by the settings panel', async () => {
    const { app, library } = createApp({ dataDir })
    close = () => library.close()
    const file = path.join(dataDir, 'assistant.md')
    expect(readFileSync(file, 'utf8')).toBe(PERSONA_TEMPLATE)
    expect(await (await app.request('/api/assistant/persona')).json()).toEqual({ text: PERSONA_TEMPLATE })
    const saved = await app.request('/api/assistant/persona', { ...chat({ text: '你叫阿毛。' }), method: 'PUT' })
    expect(await saved.json()).toEqual({ text: '你叫阿毛。' })
    expect(readFileSync(file, 'utf8')).toBe('你叫阿毛。')
    expect((await app.request('/api/assistant/persona', { ...chat({}), method: 'PUT' })).status).toBe(400)
    expect((await app.request('/api/assistant/persona', { ...chat({ text: 'x'.repeat(20_001) }), method: 'PUT' })).status).toBe(413)
  })

  it('keeps a file the user wrote', () => {
    writeFileSync(path.join(dataDir, 'assistant.md'), 'mine')
    const { library } = createApp({ dataDir })
    close = () => library.close()
    expect(readFileSync(path.join(dataDir, 'assistant.md'), 'utf8')).toBe('mine')
  })

  it('goes after the system message, without its comments, read again for every question', async () => {
    const sent: string[] = []
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent.push((JSON.parse(init.body as string) as { messages: Array<{ content: string }> }).messages[0].content)
      return new Response('data: [DONE]\n\n')
    }) as typeof fetch
    const { app, library } = createApp({ dataDir, assistant: { setup: () => ({ config: { baseUrl: 'http://x', apiKey: '', model: 'm' } }), fetch: fetcher } })
    close = () => library.close()
    const ask = () => app.request('/api/assistant/chat', chat({ messages: [{ role: 'system', content: 'Rules.' }, { role: 'user', content: 'hi' }] }))
    await ask()
    expect(sent[0]).toBe('Rules.')
    writeFileSync(path.join(dataDir, 'assistant.md'), '<!-- a hint -->\n你叫阿毛，说东北话。\n<!--\nmore\n-->')
    await ask()
    expect(sent[1]).toMatch(/^Rules\.\n\nThe user's own notes .*:\n你叫阿毛，说东北话。$/)
  })
})
