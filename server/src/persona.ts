// The pet's personality (2026-11-12): data/assistant.md, written by the user (by hand or on the pet's settings
// panel), made from a template on the first start. Read again for every question and added after the built-in
// rules of the system message, so it sets the role, tone and what the pet should know about the user, but cannot
// switch off the rules the tools rely on. HTML comments (the template's hints) are left out.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** What data/assistant.md is made with on the first start: nothing (the user's choice, 2026-11-17). */
export const PERSONA_TEMPLATE = ''

/** The most the file may hold: a few pages of notes, not a book. */
export const MAX_PERSONA_BYTES = 20_000

export class Persona {
  readonly file: string

  constructor(file: string) {
    this.file = file
    if (!existsSync(file)) writeFileSync(file, PERSONA_TEMPLATE)
  }

  /** The file as it is (empty when it was deleted meanwhile). */
  read(): string {
    try {
      return readFileSync(this.file, 'utf8')
    } catch {
      return ''
    }
  }

  write(text: string) {
    writeFileSync(this.file, text)
  }

  /** What goes to the model: the file without its comments, or empty. */
  forModel(): string {
    return this.read()
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  }
}

/** The system message with the user's notes added (the first message, when it is the system's); else as it was. */
export function withPersona(messages: unknown[], persona: string): unknown[] {
  const first = messages[0] as { role?: unknown; content?: unknown } | undefined
  if (!persona || first?.role !== 'system' || typeof first.content !== 'string') return messages
  const notes = `\n\nThe user's own notes on who you are and on themselves (follow them unless they conflict with the rules above):\n${persona}`
  return [{ ...first, content: first.content + notes }, ...messages.slice(1)]
}
