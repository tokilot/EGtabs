import { exporter, importer, midi, model, Settings } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { DRUM_PIECES, articulationFor } from './drumPieces.ts'
import { TabEditor } from './tabEditor.ts'

// A guitar track (alphaTex) and a drum track as the online tab converter makes it: no list of pieces of its own,
// notes holding ids. Two bars of 4/4; the drums play kick, hi-hat, snare, hi-hat in the first, rests in the second.
function setup(withList = false) {
  const settings = new Settings()
  const score = importer.ScoreLoader.loadAlphaTex('\\track "Lead"\n\\tuning E4 B3 G3 D3 A2 E2\n:4 0.6 3.5 2.3 r | r r r r', settings)
  const track = new model.Track()
  track.name = 'Drums'
  track.ensureStaveCount(1)
  track.playbackInfo.primaryChannel = 9
  track.playbackInfo.secondaryChannel = 9
  const staff = track.staves[0]
  staff.isPercussion = true
  staff.showTablature = false
  score.addTrack(track)
  if (withList) track.percussionArticulations = [36, 38, 42].map((id) => articulationFor(DRUM_PIECES.find((item) => item.id === id)!))
  const pieces = withList ? [0, 2, 1, 2] : [36, 42, 38, 42]
  for (let index = 0; index < 2; index++) {
    const bar = new model.Bar()
    staff.addBar(bar)
    const voice = new model.Voice()
    bar.addVoice(voice)
    for (const piece of pieces) {
      const beat = new model.Beat()
      beat.duration = model.Duration.Quarter
      if (index === 0) {
        const note = new model.Note()
        note.percussionArticulation = piece
        beat.addNote(note)
      }
      voice.addBeat(beat)
    }
  }
  score.finish(settings)
  return { score, settings, editor: (index: number) => new TabEditor(score, index, settings) }
}

/** The drum keys each beat of a bar plays (sorted), '-' for a rest. */
function keys(score: model.Score, bar: number): string[] {
  const file = new midi.MidiFile()
  new midi.MidiFileGenerator(score, new Settings(), new midi.AlphaSynthMidiFileHandler(file)).generate()
  const masterBar = score.masterBars[bar]
  const beats = score.tracks[1].staves[0].bars[bar].voices[0].beats
  const notes = file.events.filter((event) => event.type === midi.MidiEventType.NoteOn && (event as midi.NoteOnEvent).channel === 9) as midi.NoteOnEvent[]
  return beats.map((beat) => {
    const start = masterBar.start + beat.playbackStart
    const at = notes.filter((event) => event.tick === start).map((event) => event.noteKey)
    return at.length ? at.sort((a, b) => a - b).join('+') : '-'
  })
}

describe('the drum pieces offered', () => {
  it("are alphaTab's own: the same ids, lines, keys and note heads", () => {
    // alphaTab writes its whole table for a drum track without a list of its own (the exporter as it comes).
    const { score } = setup()
    const bytes = new exporter.Gp7Exporter().export(score, new Settings())
    const table = importer.ScoreLoader.loadScoreFromBytes(bytes, new Settings()).tracks[1].percussionArticulations
    expect(table.length).toBeGreaterThan(90)
    const read = (item: model.InstrumentArticulation) => [item.id, item.elementType, item.staffLine, item.outputMidiNumber, item.noteHeadDefault, item.noteHeadHalf, item.noteHeadWhole]
    const written = new Map(table.map((item) => [`${item.id}:${item.elementType}`, read(item)]))
    for (const piece of DRUM_PIECES) expect(read(articulationFor(piece))).toEqual(written.get(`${piece.id}:${piece.element}`))
  })
})

describe('editing a drum track', () => {
  it('puts kit pieces on a beat and takes them off with the digit keys; up and down pick one of its notes', () => {
    const { score, editor } = setup()
    const drums = editor(1)
    expect(drums.editable).toBe(true)
    drums.moveTo({ bar: 1, beat: 0 })
    expect(drums.state().drum).toEqual({ pieces: [], current: null })
    // 1 kick, 2 snare, 3 closed hi-hat (see DRUM_PALETTE).
    drums.typeDigit(1)
    drums.typeDigit(2)
    drums.typeDigit(3)
    expect(keys(score, 1)).toEqual(['36+38+42', '-', '-', '-'])
    // The cursor is on the piece put last; the beat's pieces are listed top of the staff first.
    expect(drums.state().drum).toEqual({ pieces: [{ id: 42, name: '闭镲' }, { id: 38, name: '小鼓' }, { id: 36, name: '底鼓' }], current: 42 })
    // Up and down go from note to note, and stop at the ends.
    drums.stepString(-1)
    expect(drums.state().drum?.current).toBe(38)
    drums.stepString(-1)
    drums.stepString(-1)
    expect(drums.state().drum?.current).toBe(36)
    drums.stepString(1)
    expect(drums.state().drum?.current).toBe(38)
    // The open hi-hat takes the closed one's place (one note per line); typed again, it comes off.
    drums.typeDigit(4)
    expect(keys(score, 1)).toEqual(['36+38+46', '-', '-', '-'])
    drums.typeDigit(4)
    expect(keys(score, 1)).toEqual(['36+38', '-', '-', '-'])
    // Delete takes the note the cursor is on, and the cursor goes to one that is left.
    drums.moveTo({ string: 3 })
    drums.removeNote()
    expect(keys(score, 1)).toEqual(['36', '-', '-', '-'])
    expect(drums.state().drum?.current).toBe(36)
    drums.undo()
    expect(keys(score, 1)).toEqual(['36+38', '-', '-', '-'])
    // A rest beat has nothing to pick; the next beat with notes picks the one nearest the line the cursor was on.
    drums.moveTo({ bar: 1, beat: 1 })
    expect(drums.note).toBeNull()
    drums.moveTo({ bar: 1, beat: 0, string: 0 })
    expect(drums.state().drum?.current).toBe(38)
  })

  it('puts a piece far from the staff on its own line, which the cursor then stops on', () => {
    const { score, editor } = setup()
    const drums = editor(1)
    drums.moveTo({ bar: 1, beat: 1 })
    expect(drums.drumLines()).not.toContain(-9)
    drums.setDrumPiece(77)
    expect(keys(score, 1)).toEqual(['-', '77', '-', '-'])
    expect(drums.cursor.string).toBe(-9)
    expect(drums.drumLines()).toContain(-9)
  })

  it('keeps to drum techniques: ghost notes and accents, not a guitar’s', () => {
    const { editor } = setup()
    const drums = editor(1)
    drums.moveTo({ bar: 0, beat: 2, string: 3 })
    expect(drums.note?.percussionArticulation).toBe(38)
    drums.toggle('ghost')
    drums.setAccent(model.AccentuationType.Heavy)
    drums.toggle('hammer')
    drums.toggle('palmMute')
    drums.setFret(5)
    drums.moveNote(1)
    const note = drums.note!
    expect([note.isGhost, note.accentuated, note.isHammerPullOrigin, note.isPalmMute, note.percussionArticulation]).toEqual([true, model.AccentuationType.Heavy, false, false, 38])
  })

  it('adds a piece a track’s own list lacks to the list, and undo takes it out again', () => {
    const { score, editor } = setup(true)
    const drums = editor(1)
    expect(keys(score, 0)).toEqual(['36', '42', '38', '42'])
    drums.moveTo({ bar: 1, beat: 0 })
    drums.setDrumPiece(49)
    expect(score.tracks[1].percussionArticulations.map((item) => item.id)).toEqual([36, 38, 42, 49])
    expect(keys(score, 1)).toEqual(['49', '-', '-', '-'])
    drums.undo()
    expect(score.tracks[1].percussionArticulations.map((item) => item.id)).toEqual([36, 38, 42])
    expect(keys(score, 1)).toEqual(['-', '-', '-', '-'])
  })
})

describe('copying and pasting drums', () => {
  it('pastes between drum tracks, the pieces kept whatever each track calls them', () => {
    const plain = setup()
    const listed = setup(true)
    const from = plain.editor(1)
    from.moveTo({ bar: 0, beat: 0 })
    from.moveTo({ beat: 3 }, true)
    const clipboard = from.copy()
    const to = listed.editor(1)
    to.moveTo({ bar: 1, beat: 0 })
    expect(to.paste(clipboard)).toEqual({ droppedNotes: 0, cutBeats: 0 })
    expect(keys(listed.score, 1)).toEqual(['36', '42', '38', '42'])
    // And back the other way.
    const back = listed.editor(1)
    back.moveTo({ bar: 0, beat: 0 })
    back.moveTo({ beat: 3 }, true)
    const target = plain.editor(1)
    target.moveTo({ bar: 1, beat: 0 })
    target.paste(back.copy())
    expect(keys(plain.score, 1)).toEqual(['36', '42', '38', '42'])
  })

  it('does not paste guitar beats into drums, or drums into a guitar track', () => {
    const { score, editor } = setup()
    const guitar = editor(0)
    const drums = editor(1)
    const fromGuitar = guitar.copy()
    const fromDrums = drums.copy()
    expect(drums.canPaste(fromGuitar)).toBe(false)
    expect(guitar.canPaste(fromDrums)).toBe(false)
    drums.moveTo({ bar: 1, beat: 0 })
    drums.paste(fromGuitar)
    guitar.moveTo({ bar: 1, beat: 0 })
    guitar.paste(fromDrums)
    expect(keys(score, 1)).toEqual(['-', '-', '-', '-'])
    expect(score.tracks[0].staves[0].bars[1].voices[0].beats.every((beat) => beat.notes.length === 0)).toBe(true)
    expect(drums.state().canUndo || guitar.state().canUndo).toBe(false)
  })
})
