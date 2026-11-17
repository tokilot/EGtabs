// The effect tones for the assistant (2026-11-12): the module catalogue, a tone's chain, and changes to a chain, in
// the model's terms (module, type and knob ids; knob values in their own ranges). Changes are checked here; a
// mistake is an Error whose message tells the model what is allowed.
import type { ToneFamily } from '../audio/tone.ts'
import { MODULE_ORDER, MODULES, paramsFor, type ModuleId, type ToneChain } from '../audio/toneChain.ts'

/** Every module, its types and its knobs (range, unit, and which types have it when not all). */
export function moduleCatalog() {
  return MODULE_ORDER.map((id) => ({
    module: id,
    types: MODULES[id].types.map((type) => type.id),
    knobs: MODULES[id].params.map((param) => ({
      knob: param.key,
      min: param.min,
      max: param.max,
      default: param.default,
      ...(param.unit ? { unit: param.unit } : {}),
      ...(param.types ? { onlyFor: param.types } : {}),
    })),
  }))
}

/** A chain as the model reads it: the modules that are on with their type and knobs; the others "off". */
export function chainSummary(chain: ToneChain): Record<string, unknown> {
  return Object.fromEntries(
    MODULE_ORDER.map((id) => {
      const module = chain[id]
      if (!module.on) return [id, 'off']
      const knobs = Object.fromEntries(paramsFor(id, module.type).map((param) => [param.key, module.params[param.key]]))
      return [id, { type: module.type, ...knobs }]
    }),
  )
}

export interface ModuleChange {
  on?: boolean
  type?: string
  knobs?: Record<string, number>
}

/**
 * The chain with the changes made: per module, switched on or off, another type, knobs set (held in their range;
 * each value held is noted). Changing a module's type or knobs switches it on unless `on` says otherwise.
 */
export function changeChain(chain: ToneChain, changes: unknown): { chain: ToneChain; notes: string[] } {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('"changes" must be an object of modules, e.g. {"amp": {"type": "crunch", "knobs": {"gain": 60}}}.')
  const next = structuredClone(chain)
  const notes: string[] = []
  for (const [key, raw] of Object.entries(changes as Record<string, unknown>)) {
    if (!MODULE_ORDER.includes(key as ModuleId)) throw new Error(`There is no module "${key}"; the modules are ${MODULE_ORDER.join(', ')}.`)
    const id = key as ModuleId
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`The change of "${id}" must be an object with on, type and/or knobs.`)
    const change = raw as ModuleChange
    const module = next[id]
    if (change.type !== undefined) {
      const types = MODULES[id].types.map((type) => type.id)
      if (!types.includes(change.type)) throw new Error(`"${id}" has no type "${change.type}"; its types are ${types.join(', ')}.`)
      module.type = change.type
    }
    if (change.knobs !== undefined) {
      if (!change.knobs || typeof change.knobs !== 'object' || Array.isArray(change.knobs)) throw new Error(`The knobs of "${id}" must be an object of numbers.`)
      const specs = paramsFor(id, module.type)
      for (const [knob, value] of Object.entries(change.knobs)) {
        const spec = specs.find((param) => param.key === knob)
        if (!spec) throw new Error(`"${id}" (type ${module.type}) has no knob "${knob}"; its knobs are ${specs.map((param) => param.key).join(', ')}.`)
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`The knob "${id}.${knob}" must be a number.`)
        const held = Math.min(spec.max, Math.max(spec.min, Math.round(value / spec.step) * spec.step))
        const rounded = Math.round(held * 1000) / 1000
        if (rounded !== value) notes.push(`${id}.${knob} set to ${rounded} (range ${spec.min}–${spec.max}, step ${spec.step})`)
        module.params[knob] = rounded
      }
    }
    if (change.on !== undefined) {
      if (typeof change.on !== 'boolean') throw new Error(`"${id}.on" must be true or false.`)
      module.on = change.on
    } else if (change.type !== undefined || change.knobs !== undefined) {
      module.on = true
    }
  }
  return { chain: next, notes }
}

export function isFamily(value: unknown): value is ToneFamily {
  return value === 'guitar' || value === 'bass'
}
