import { describe, expect, it } from 'vitest'
import { chainWith, defaultChain } from '../audio/toneChain.ts'
import { chainSummary, changeChain, moduleCatalog } from './toneText.ts'

describe('tones for the assistant', () => {
  it('lists every module with its types and knob ranges', () => {
    const catalog = moduleCatalog()
    expect(catalog.map((item) => item.module)).toEqual(['dyna', 'filter', 'od', 'amp', 'cab', 'eq', 'mod', 'delay', 'reverb'])
    const amp = catalog.find((item) => item.module === 'amp')!
    expect(amp.types).toContain('metal')
    expect(amp.knobs.find((knob) => knob.knob === 'gain')).toEqual({ knob: 'gain', min: 0, max: 100, default: 50 })
    const delay = catalog.find((item) => item.module === 'delay')!
    expect(delay.knobs[0]).toEqual({ knob: 'time', min: 20, max: 1500, default: 380, unit: 'ms' })
    expect(catalog.find((item) => item.module === 'filter')!.knobs[0]).toMatchObject({ knob: 'sens', onlyFor: ['autowah'] })
  })

  it('shows the modules that are on with their knobs, the rest as off', () => {
    const summary = chainSummary(chainWith({ od: { type: 'overdrive', params: { gain: 10 } } }))
    expect(summary.od).toEqual({ type: 'overdrive', gain: 10, tone: 50, level: 60 })
    expect(summary.amp).toMatchObject({ type: 'clean', gain: 50 })
    expect(summary.delay).toBe('off')
  })

  it('changes types and knobs, switches the modules it touches on, holds values in range', () => {
    const { chain, notes } = changeChain(defaultChain(), {
      amp: { type: 'metal', knobs: { gain: 120, bass: 40.4 } },
      delay: { knobs: { time: 333 } },
      cab: { on: false },
    })
    expect(chain.amp).toMatchObject({ on: true, type: 'metal' })
    expect(chain.amp.params.gain).toBe(100)
    expect(chain.amp.params.bass).toBe(40)
    expect(chain.delay).toMatchObject({ on: true })
    expect(chain.delay.params.time).toBe(330)
    expect(chain.cab.on).toBe(false)
    expect(notes).toEqual(['amp.gain set to 100 (range 0–100, step 1)', 'amp.bass set to 40 (range 0–100, step 1)', 'delay.time set to 330 (range 20–1500, step 10)'])
  })

  it('leaves the chain it was given alone', () => {
    const before = defaultChain()
    changeChain(before, { amp: { knobs: { gain: 90 } } })
    expect(before.amp.params.gain).toBe(50)
  })

  it('says what is allowed when a change is wrong', () => {
    expect(() => changeChain(defaultChain(), { booster: {} })).toThrow('the modules are dyna, filter')
    expect(() => changeChain(defaultChain(), { amp: { type: 'plexi' } })).toThrow('its types are clean, crunch')
    expect(() => changeChain(defaultChain(), { filter: { type: 'wah', knobs: { sens: 5 } } })).toThrow('its knobs are position, q')
    expect(() => changeChain(defaultChain(), { amp: { knobs: { gain: 'loud' } } })).toThrow('must be a number')
    expect(() => changeChain(defaultChain(), [])).toThrow('must be an object of modules')
  })
})
