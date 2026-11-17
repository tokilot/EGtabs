import { importer, Settings } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { barsText } from './scoreText.ts'
import { TabEditor } from './tabEditor.ts'
import { applyEdits } from './tabEdits.ts'

// Two bars of 4/4 in standard tuning (alphaTex: fret.string, string 1 the highest).
const TEX = `\\title "Edits"
.
\\track "Lead"
\\tuning E4 B3 G3 D3 A2 E2
:4 0.6 3.5 2.3 r | :4 5.1 7.1 8.1 r
`

function setup() {
  const settings = new Settings()
  const score = importer.ScoreLoader.loadAlphaTex(TEX, settings)
  const editor = new TabEditor(score, 0, settings)
  const text = () => barsText(score, 0, 1, score.masterBars.length).split('\n').slice(1)
  return { score, editor, text }
}

describe('the assistant edits a tab', () => {
  it('sets, removes and marks notes with strings counted from the highest', () => {
    const { editor, text } = setup()
    const outcome = applyEdits(editor, [
      { op: 'note', bar: 1, beat: 4, string: 1, fret: 12 },
      { op: 'note', bar: 1, beat: 3, string: 2, fret: 3 },
      { op: 'remove_note', bar: 1, beat: 2, string: 5 },
      { op: 'technique', bar: 2, beat: 1, string: 1, name: 'hammer' },
      { op: 'vibrato', bar: 2, beat: 3, string: 1, kind: 'wide' },
      { op: 'technique', bar: 1, beat: 1, name: 'palmMute' },
    ])
    expect(outcome).toEqual({ done: 6, bars: [1, 2], unbalanced: [] })
    expect(text()).toEqual([
      'bar 1 (4/4): 1) 4 6:0(pm) | 2) 4 rest | 3) 4 2:3 3:2 | 4) 4 1:12',
      'bar 2 (4/4): 1) 4 1:5(h/p) | 2) 4 1:7 | 3) 4 1:8(vib) | 4) 4 rest',
    ])
  })

  it('changes durations and says which bars no longer add up', () => {
    const { editor, text } = setup()
    const outcome = applyEdits(editor, [
      { op: 'duration', bar: 2, beat: 1, value: 8 },
      { op: 'duration', bar: 2, beat: 2, value: 8 },
      { op: 'insert_beat', bar: 1, beat: 4 },
    ])
    expect(outcome.unbalanced).toEqual([
      { bar: 1, fill: 'over' },
      { bar: 2, fill: 'short' },
    ])
    expect(text()[1]).toBe('bar 2 (4/4): 1) 8 1:5 | 2) 8 1:7 | 3) 4 1:8 | 4) 4 rest')
  })

  it('adds and removes bars and sets bar-wide things', () => {
    const { score, editor } = setup()
    applyEdits(editor, [
      { op: 'insert_bar', bar: 1 },
      { op: 'section', bar: 2, text: 'Bridge' },
      { op: 'tempo', bar: 3, bpm: 140 },
      { op: 'time_signature', bar: 3, numerator: 3, denominator: 4 },
    ])
    expect(score.masterBars.length).toBe(3)
    expect(score.masterBars[1].section?.text).toBe('Bridge')
    expect(score.masterBars[2].tempoAutomations[0].value).toBe(140)
    expect(score.masterBars[2].timeSignatureNumerator).toBe(3)
    applyEdits(editor, [{ op: 'delete_bar', bar: 2 }])
    expect(score.masterBars.length).toBe(2)
  })

  it('is one step of the history: one undo takes every edit back', () => {
    const { editor, text } = setup()
    const before = text()
    const step = editor.group(() => {
      applyEdits(editor, [
        { op: 'note', bar: 1, beat: 4, string: 1, fret: 12 },
        { op: 'insert_bar', bar: 2 },
        { op: 'note', bar: 3, beat: 1, string: 6, fret: 3 },
        { op: 'duration', bar: 1, beat: 1, value: 2 },
      ])
    })
    expect(step).not.toBeNull()
    expect(text()).not.toEqual(before)
    expect(editor.state().dirty).toBe(true)
    expect(editor.undoStep(step!)).toBe(true)
    expect(text()).toEqual(before)
    expect(editor.state()).toMatchObject({ dirty: false, canUndo: false, canRedo: true })
    // Redone as one step as well.
    editor.redo()
    expect(text()).toHaveLength(3)
  })

  it('does not undo a step that later edits came after', () => {
    const { editor } = setup()
    const step = editor.group(() => applyEdits(editor, [{ op: 'note', bar: 1, beat: 4, string: 1, fret: 1 }]))!
    editor.moveTo({ bar: 0, beat: 0 })
    editor.setFret(7)
    expect(editor.undoStep(step)).toBe(false)
  })

  it('keeps what was done before a wrong operation, and says what is wrong', () => {
    const { editor, text } = setup()
    expect(() => applyEdits(editor, [{ op: 'note', bar: 1, beat: 4, string: 1, fret: 9 }, { op: 'note', bar: 1, beat: 9, string: 1, fret: 1 }])).toThrow(
      'Edit 2: "beat" must be between 1 and 4.',
    )
    expect(text()[0]).toContain('4) 4 1:9')
    expect(() => applyEdits(editor, [{ op: 'note', bar: 1, beat: 1, string: 7, fret: 1 }])).toThrow('"string" must be between 1 and 6')
    expect(() => applyEdits(editor, [{ op: 'slide', bar: 1, beat: 4, string: 1, kind: 'up' }])).toThrow('"kind" must be one of none, legato')
    expect(() => applyEdits(editor, [{ op: 'bend', bar: 1, beat: 2, string: 1, kind: 'full' }])).toThrow('there is no note on string 1')
    expect(() => applyEdits(editor, [{ op: 'strum', bar: 1, beat: 1 }])).toThrow('no operation "strum"')
    expect(() => applyEdits(editor, [])).toThrow('non-empty list')
  })
})
