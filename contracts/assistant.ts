// The assistant (the pet in the corner, 2026-11-12): what the server says about the model it talks to
// (server/src/assistant.ts, web/src/assistant/).

export interface AssistantStatus {
  /** A model is set up (TABS_AI_BASE_URL and TABS_AI_MODEL in .env.local; TABS_AI_API_KEY when the service needs a key). */
  ready: boolean
  /** The model's name, as configured. */
  model: string
  /** Why it is not ready (in English, shown as is). */
  problem?: string
}
