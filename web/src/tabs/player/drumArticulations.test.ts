import { exporter, importer, midi, model, Settings } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { repairDrumArticulations } from './drumArticulations.ts'

/** A drum track as the online tab converter makes it: no articulation list, notes holding ids (36 kick, 38 snare, 42 hi-hat). */
function drumScore(): model.Score {
  const score = new model.Score()
  const masterBar = new model.MasterBar()
  score.addMasterBar(masterBar)
  const track = new model.Track()
  track.ensureStaveCount(1)
  track.playbackInfo.primaryChannel = 9
  track.playbackInfo.secondaryChannel = 9
  const staff = track.staves[0]
  staff.isPercussion = true
  staff.showTablature = false
  score.addTrack(track)
  const bar = new model.Bar()
  staff.addBar(bar)
  const voice = new model.Voice()
  bar.addVoice(voice)
  for (const id of [36, 42, 38, 42]) {
    const beat = new model.Beat()
    beat.duration = model.Duration.Quarter
    const note = new model.Note()
    note.percussionArticulation = id
    beat.addNote(note)
    voice.addBeat(beat)
  }
  score.finish(new Settings())
  return score
}

/** The MIDI keys the drum notes play. */
function keys(score: model.Score): number[] {
  const file = new midi.MidiFile()
  new midi.MidiFileGenerator(score, new Settings(), new midi.AlphaSynthMidiFileHandler(file)).generate()
  return file.events.filter((event) => event.type === midi.MidiEventType.NoteOn && (event as midi.NoteOnEvent).channel === 9).map((event) => (event as midi.NoteOnEvent).noteKey)
}

describe('drum notes saved as Guitar Pro', () => {
  it('play what they say before saving', () => {
    expect(keys(drumScore())).toEqual([36, 42, 38, 42])
  })

  it('read back from a file written the old way are put back on their kit pieces', () => {
    // alphaTab as it comes (not patched here): the default list written, the ids left in the notes.
    const bytes = new exporter.Gp7Exporter().export(drumScore(), new Settings())
    const loaded = importer.ScoreLoader.loadScoreFromBytes(bytes, new Settings())
    expect(loaded.tracks[0].percussionArticulations.length).toBeGreaterThan(40)
    // As read: bongos and agogos.
    expect(keys(loaded)).not.toEqual([36, 42, 38, 42])
    expect(repairDrumArticulations(loaded)).toBe(4)
    expect(keys(loaded)).toEqual([36, 42, 38, 42])
    // Once right, it stays right.
    expect(repairDrumArticulations(loaded)).toBe(0)
  })

  it('leave a track whose notes are indices already', () => {
    const score = drumScore()
    // A list of its own, the notes pointing into it (as Guitar Pro writes them).
    const kick = new model.InstrumentArticulation('Kick', 0, 36)
    kick.id = 36
    const snare = new model.InstrumentArticulation('Snare', 0, 38)
    snare.id = 38
    const hat = new model.InstrumentArticulation('Hi-Hat', 0, 42)
    hat.id = 42
    score.tracks[0].percussionArticulations = [kick, snare, hat]
    const notes = score.tracks[0].staves[0].bars[0].voices[0].beats.map((beat) => beat.notes[0])
    notes.forEach((note, index) => (note.percussionArticulation = [0, 2, 1, 2][index]))
    expect(repairDrumArticulations(score)).toBe(0)
    expect(keys(score)).toEqual([36, 42, 38, 42])
  })
})
