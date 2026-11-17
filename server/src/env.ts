// The settings in the repository's .env.local (2026-11-12; named so 2026-11-17), in the .env format: one TABS_…=value per line,
// comments with #; .env.example lists them all. Values set in the system's environment win over the file's.
// Loaded into process.env when the server starts (dev.ts, index.ts); the assistant's three are read from the file
// again for every request, so changing the model or the key needs no restart. TABS_ENV_FILE points elsewhere
// (the end-to-end tests point it at a file of their own, so a developer's .env.local does not leak into them).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import type { AssistantConfig } from './assistant.ts'

export const ENV_FILE = path.resolve(process.env.TABS_ENV_FILE ?? path.join(import.meta.dirname, '../../.env.local'))

/** The environment as the system gave it, before .env.local was loaded into it. */
const systemEnv: NodeJS.ProcessEnv = { ...process.env }

/** Fills process.env from .env.local (values already set stay); nothing when there is no such file. */
export function loadEnvFile(file = ENV_FILE) {
  if (existsSync(file)) process.loadEnvFile(file)
}

/** The settings now: .env.local as it is at this moment, under the system's environment. */
export function currentEnv(file = ENV_FILE): NodeJS.ProcessEnv {
  let fromFile: NodeJS.ProcessEnv = {}
  try {
    fromFile = parseEnv(readFileSync(file, 'utf8')) as NodeJS.ProcessEnv
  } catch {
    // no .env.local, or unreadable: the system's environment only
  }
  const env: NodeJS.ProcessEnv = { ...fromFile }
  for (const [key, value] of Object.entries(systemEnv)) if (value !== undefined && value !== '') env[key] = value
  return env
}

/** The assistant's model as the settings give it, or why it cannot be used (in English, shown as is). */
export type AssistantSetup = { config: AssistantConfig } | { problem: string }

export function assistantSetup(env: NodeJS.ProcessEnv): AssistantSetup {
  const baseUrl = env.TABS_AI_BASE_URL?.trim() ?? ''
  const model = env.TABS_AI_MODEL?.trim() ?? ''
  if (!baseUrl || !model) {
    return { problem: `Set TABS_AI_BASE_URL and TABS_AI_MODEL in .env.local (copy .env.example to .env.local if there is none).` }
  }
  // TABS_AI_STREAM=false: whole answers rather than streamed ones, for services whose streaming loses text.
  const stream = !/^(false|0|no|off)$/i.test(env.TABS_AI_STREAM?.trim() ?? '')
  return { config: { baseUrl, model, apiKey: env.TABS_AI_API_KEY?.trim() ?? '', ...(stream ? {} : { stream: false }) } }
}
