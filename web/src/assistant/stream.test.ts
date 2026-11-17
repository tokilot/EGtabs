import { describe, expect, it } from 'vitest'
import { sseData, TurnBuilder } from './stream.ts'

function streamOf(...pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece))
      controller.close()
    },
  })
}

describe('the model stream', () => {
  it('splits events across chunks that cut lines in two', async () => {
    const data: string[] = []
    for await (const item of sseData(streamOf('data: {"a"', ':1}\n\n: keep-alive\r\ndata: [DO', 'NE]\n\n'))) data.push(item)
    expect(data).toEqual(['{"a":1}', '[DONE]'])
  })

  it('puts the text together as it comes', () => {
    const turn = new TurnBuilder()
    expect(turn.add('{"choices":[{"delta":{"role":"assistant","content":""}}]}')).toBe('')
    expect(turn.add('{"choices":[{"delta":{"content":"Hel"}}]}')).toBe('Hel')
    expect(turn.add('{"choices":[{"delta":{"content":"lo"}}]}')).toBe('lo')
    expect(turn.add('[DONE]')).toBe('')
    expect(turn.turn()).toEqual({ content: 'Hello', toolCalls: [] })
  })

  it('puts tool calls together from pieces, several at once', () => {
    const turn = new TurnBuilder()
    turn.add('{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","type":"function","function":{"name":"set_speed","arguments":""}}]}}]}')
    turn.add('{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"perc"}}]}}]}')
    turn.add('{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ent\\":70}"}}]}}]}')
    turn.add('{"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"clear_loop"}}]}}]}')
    expect(turn.turn().toolCalls).toEqual([
      { id: 'a', type: 'function', function: { name: 'set_speed', arguments: '{"percent":70}' } },
      { id: 'b', type: 'function', function: { name: 'clear_loop', arguments: '{}' } },
    ])
  })

  it('raises the error a service sends in the stream', () => {
    expect(() => new TurnBuilder().add('{"error":{"message":"rate limited"}}')).toThrow('rate limited')
  })
})
