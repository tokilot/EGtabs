import { importer, Settings } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { barsText } from './scoreText.ts'
import { TabEditor } from './tabEditor.ts'

// A guitar and a bass track, two bars of 4/4 each (alphaTex: fret.string, string 1 the highest).
const TEX = `\\title "Clip" \\artist "Someone"
.
\\track "Lead"
\\tuning E4 B3 G3 D3 A2 E2
:4 0.6 3.5 2.3 r | :8 5.1 7.1 :4 8.1 r r
\\track "Bass"
\\tuning G2 D2 A1 E1
:4 0.4 2.4 3.3 5.3 | :2 0.2 2.1
`

function setup() {
  const settings = new Settings()
  const score = importer.ScoreLoader.loadAlphaTex(TEX, settings)
  const editor = (track: number) => new TabEditor(score, track, settings)
  const bars = (track: number) => barsText(score, track, 1, score.masterBars.length).split('\n').slice(1)
  return { score, editor, bars }
}

describe('copying and pasting beats', () => {
  it('selects beats with shift, across bar lines, in either direction', () => {
    const { editor } = setup()
    const lead = editor(0)
    lead.moveTo({ bar: 0, beat: 2 })
    lead.stepBeat(1, true)
    lead.stepBeat(1, true)
    expect(lead.state().selection).toEqual({ from: { bar: 0, beat: 2 }, to: { bar: 1, beat: 0 }, beats: 3 })
    expect(lead.copy().beats).toHaveLength(3)
    // Back past the start: the other way round.
    lead.stepBeat(-1, true)
    lead.stepBeat(-1, true)
    lead.stepBeat(-1, true)
    expect(lead.state().selection).toEqual({ from: { bar: 0, beat: 1 }, to: { bar: 0, beat: 2 }, beats: 2 })
    // A plain move drops it; then only the cursor beat is copied.
    lead.moveTo({ beat: 0 })
    expect(lead.state().selection).toBeNull()
    expect(lead.copy().beats).toHaveLength(1)
  })

  it('pastes into another track over the same time, strings counted from the highest, frets as they are', () => {
    const { editor, bars } = setup()
    const lead = editor(0)
    lead.moveTo({ bar: 0, beat: 1 })
    lead.moveTo({ beat: 2 }, true)
    const clipboard = lead.copy()
    const bass = editor(1)
    bass.moveTo({ bar: 0, beat: 0 })
    // String 5 (A on the guitar) is not on a four-string bass; string 3 stays string 3.
    expect(bass.paste(clipboard)).toEqual({ droppedNotes: 1, cutBeats: 0 })
    expect(bars(1)[0]).toBe('bar 1 (4/4): 1) 4 rest | 2) 4 3:2 | 3) 4 3:3 | 4) 4 3:5')
    expect(bars(1)[1]).toBe('bar 2 (4/4): 1) 2 2:0 | 2) 2 1:2')
    expect(bars(0)[0]).toBe('bar 1 (4/4): 1) 4 6:0 | 2) 4 5:3 | 3) 4 3:2 | 4) 4 rest')
  })

  it('carries over into the next bar, keeping both bars full', () => {
    const { editor, bars } = setup()
    const lead = editor(0)
    // Two eighths and a quarter (half a bar) ...
    lead.moveTo({ bar: 1, beat: 0 })
    lead.moveTo({ beat: 2 }, true)
    const clipboard = lead.copy()
    // ... pasted on the last quarter of bar 1: the eighths fill it, the quarter goes on into bar 2.
    lead.moveTo({ bar: 0, beat: 3 })
    lead.paste(clipboard)
    expect(bars(0)).toEqual([
      'bar 1 (4/4): 1) 4 6:0 | 2) 4 5:3 | 3) 4 3:2 | 4) 8 1:5 | 5) 8 1:7',
      'bar 2 (4/4): 1) 4 1:8 | 2) 4 1:8 | 3) 4 rest | 4) 4 rest',
    ])
    for (const bar of [0, 1]) {
      lead.moveTo({ bar, beat: 0 })
      expect(lead.state().barFill).toBe('full')
    }
  })

  it('fills with rests what a longer beat it replaced leaves over (the top string stays the top string)', () => {
    const { editor, bars } = setup()
    const lead = editor(0)
    lead.moveTo({ bar: 1, beat: 0 })
    const eighth = lead.copy()
    const bass = editor(1)
    bass.moveTo({ bar: 1, beat: 0 })
    bass.paste(eighth)
    expect(bars(1)[1]).toBe('bar 2 (4/4): 1) 8 1:5 | 2) 4 rest | 3) 8 rest | 4) 2 1:2')
  })

  it('stops at the end of the track and says how many beats did not fit', () => {
    const { editor } = setup()
    const lead = editor(0)
    lead.moveTo({ bar: 0, beat: 0 })
    lead.moveTo({ bar: 1, beat: 4 }, true)
    const all = lead.copy()
    lead.moveTo({ bar: 1, beat: 3 })
    expect(lead.paste(all).cutBeats).toBe(all.beats.length - 2)
  })

  it('is one step of the history', () => {
    const { editor, bars } = setup()
    const lead = editor(0)
    lead.moveTo({ bar: 0, beat: 0 })
    lead.moveTo({ bar: 1, beat: 1 }, true)
    const clipboard = lead.copy()
    const bass = editor(1)
    const before = bars(1)
    bass.moveTo({ bar: 0, beat: 2 })
    bass.paste(clipboard)
    expect(bars(1)).not.toEqual(before)
    expect(bass.undo()).toBe(true)
    expect(bars(1)).toEqual(before)
    expect(bass.state().canUndo).toBe(false)
  })
})

describe('the song title and artist in the editor', () => {
  it('change, keep a title, and undo', () => {
    const { score, editor } = setup()
    const lead = editor(0)
    lead.setSongInfo({ title: '  New name ', artist: ' Me ' })
    expect([score.title, score.artist]).toEqual(['New name', 'Me'])
    expect(lead.state()).toMatchObject({ songTitle: 'New name', songArtist: 'Me', dirty: true })
    // An empty title keeps the one there is; an empty artist is allowed.
    lead.setSongInfo({ title: ' ', artist: '' })
    expect([score.title, score.artist]).toEqual(['New name', ''])
    lead.undo()
    lead.undo()
    expect([score.title, score.artist]).toEqual(['Clip', 'Someone'])
    expect(lead.state().dirty).toBe(false)
  })
})
