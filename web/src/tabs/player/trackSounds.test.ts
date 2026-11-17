import { describe, expect, it } from 'vitest'
import { planAmpBuses } from '../../audio/ampRouting.ts'
import { INSTRUMENT_CATEGORIES } from './trackEdits.ts'
import { cleanTrackSounds, findPreset, presetPlace, sameSound, trackPresets, type ExtraSoundFont } from './trackSounds.ts'

const FONTS: ExtraSoundFont[] = [
  {
    name: 'Guitar.sf2',
    bank: 1024,
    kind: 'extra',
    presets: [
      { program: 30, name: 'GM Map (Distortion)' },
      { program: 40, name: 'DT_Sus1' },
    ],
  },
]

describe('track sounds', () => {
  it('keeps only well-formed choices', () => {
    expect(
      cleanTrackSounds({
        0: { font: 'Guitar.sf2', program: 40 },
        1: { font: '', program: 40 },
        2: { font: 'Guitar.sf2', program: 128 },
        x: { font: 'Guitar.sf2', program: 1 },
        3: 'Guitar.sf2',
      }),
    ).toEqual({ 0: { font: 'Guitar.sf2', program: 40 } })
    expect(cleanTrackSounds(null)).toEqual({})
  })

  it('finds the bank of a preset, and drops presets whose font or program is gone', () => {
    expect(findPreset(FONTS, { font: 'Guitar.sf2', program: 40 })?.name).toBe('DT_Sus1')
    expect(trackPresets(FONTS, { 0: { font: 'Guitar.sf2', program: 40 }, 1: { font: 'Gone.sf2', program: 40 }, 2: { font: 'Guitar.sf2', program: 5 } })).toEqual({
      0: { bank: 1024, program: 40 },
    })
    expect(sameSound(null, undefined)).toBe(true)
    expect(sameSound({ font: 'Guitar.sf2', program: 40 }, { font: 'Guitar.sf2', program: 40 })).toBe(true)
    expect(sameSound({ font: 'Guitar.sf2', program: 40 }, null)).toBe(false)
  })

  it('routes every program of the track to its preset on the main output, ahead of a tone', () => {
    const tracks = [
      { index: 0, channels: [0, 1], isPercussion: false },
      { index: 1, channels: [2, 3], isPercussion: true },
    ]
    const plan = planAmpBuses(tracks, { 0: 'some tone' }, () => null, null, { 0: { bank: 1024, program: 40 }, 1: { bank: 1024, program: 40 } })
    expect(plan.buses).toEqual([])
    expect(plan.routing[0][27]).toEqual([0, 40, 1024])
    expect(Object.keys(plan.routing[1])).toHaveLength(128)
    expect(plan.routing[2]).toBeUndefined()
  })

  it('gives a drum track a drum kit of a loaded set, routing only the program the tab asks for', () => {
    const fonts: ExtraSoundFont[] = [
      { name: 'Main.sf2', bank: 1000, kind: 'gm', presets: [], main: true, drums: [{ program: 25, name: '808' }] },
      { name: 'MetalDrums.sf2', bank: 1025, kind: 'extra', presets: [], drums: [{ program: 3, name: 'Drumkit' }] },
    ]
    const tracks = [
      { index: 0, channels: [9, 9], isPercussion: true },
      { index: 1, channels: [0, 1], isPercussion: false },
    ]
    const presets = trackPresets(fonts, { 0: { font: 'MetalDrums.sf2', program: 3, drums: true }, 1: { font: 'MetalDrums.sf2', program: 3, drums: true } })
    expect(presets[0]).toEqual({ bank: 128, program: 3, drums: true })
    const plan = planAmpBuses(tracks, {}, () => null, null, presets)
    expect(plan.buses).toEqual([])
    // The drums ask for program 0; other programs (a preview of another kit) are left alone.
    expect(plan.routing[9]).toEqual({ 0: [0, 3, 128] })
    // A kit is no instrument for a melodic track.
    expect(plan.routing[0]).toBeUndefined()
    expect(findPreset(fonts, { font: 'Main.sf2', program: 25, drums: true })?.name).toBe('808')
    expect(findPreset(fonts, { font: 'Main.sf2', program: 99, drums: true })).toBeNull()
    expect(cleanTrackSounds({ 0: { font: 'MetalDrums.sf2', program: 3, drums: true } })).toEqual({ 0: { font: 'MetalDrums.sf2', program: 3, drums: true } })
    // The first version kept the main set's kits under "#drums".
    const old = cleanTrackSounds({ 0: { font: '#drums', program: 25 } })
    expect(old).toEqual({ 0: { font: '#drums', program: 25, drums: true } })
    expect(trackPresets(fonts, old)[0]).toEqual({ bank: 128, program: 25, drums: true })
  })
})

describe('where extra presets go in the picker', () => {
  const label = (font: string, name: string, program: number) => {
    const at = presetPlace(font, { name, program })
    return INSTRUMENT_CATEGORIES[at.category].subs[at.sub].label
  }

  it('goes by the preset name, then the file name, then the program', () => {
    expect(label('Bread Breads Distortion Guitar.sf2', 'DT_Sus1', 40)).toBe('电吉他')
    expect(label('Bread Breads Distortion Guitar.sf2', 'GM Map (Overdrive)', 29)).toBe('电吉他')
    expect(label('My Bass.sf2', 'Finger 1', 0)).toBe('贝斯')
    expect(label('Studio.sf2', 'Acoustic Guitar', 30)).toBe('木吉他')
    expect(label('Studio.sf2', 'Bassoon', 33)).toBe('簧管')
    expect(label('Studio.sf2', 'Rhodes', 30)).toBe('钢琴')
    expect(label('Something.sf2', 'Preset 1', 33)).toBe('贝斯')
    // A General MIDI set's go by program, whatever the name says.
    expect(presetPlace('FluidR3Mono_GM.sf3', { name: 'Slap Bass', program: 0 }, 'gm')).toEqual(presetPlace('x', { name: 'x', program: 0 }, 'gm'))
  })
})
