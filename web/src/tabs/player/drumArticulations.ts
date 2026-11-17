// Drum notes saved wrong (2026-11-17). A drum note's percussionArticulation is an index into its track's
// percussionArticulations when the track has that list, or else an articulation id (alphaTab's GP7 numbering, close to
// General MIDI's). Tabs made here from online tabs and MIDI files had no list, so their notes held ids; alphaTab's
// Guitar Pro exporter then wrote its default list with the ids left as they were, and the file read back took them for
// indices: a kick (36) played the 36th entry, a bongo. Since the exporter is patched (web/alphatab-patches.ts) no new
// file is written so; this puts right a file written before. Each list entry keeps its id (the file's
// InputMidiNumbers), so a note can be put back on the entry its id names.
import type { model } from '@coderline/alphatab'

/** What a drum kit mostly plays: kick, snare, hi-hat, toms, crash, ride, china, splash (General MIDI keys). */
const KIT = new Set([35, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 55, 57, 59])

function drumNotes(track: model.Track): model.Note[] {
  const notes: model.Note[] = []
  for (const staff of track.staves) {
    if (!staff.isPercussion) continue
    for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) for (const note of beat.notes) if (note.percussionArticulation >= 0) notes.push(note)
  }
  return notes
}

/**
 * Puts drum notes that hold ids back on their entries, for each drum track whose notes make a drum kit when read as
 * ids and less of one when read as indices (as written, an index read is mostly bongos, congas and agogos). Returns
 * how many notes were put right; a tab written correctly is left as it is.
 */
export function repairDrumArticulations(score: model.Score): number {
  let repaired = 0
  for (const track of score.tracks) {
    const list = track.percussionArticulations
    if (list.length === 0) continue
    const notes = drumNotes(track)
    if (notes.length === 0) continue
    const indexOf = new Map<number, number>()
    list.forEach((articulation, index) => {
      if (!indexOf.has(articulation.id)) indexOf.set(articulation.id, index)
    })
    let asIndex = 0
    let asId = 0
    for (const note of notes) {
      const value = note.percussionArticulation
      if (KIT.has(list[value]?.outputMidiNumber ?? -1)) asIndex++
      const at = indexOf.get(value)
      if (at !== undefined && KIT.has(list[at].outputMidiNumber)) asId++
    }
    if (asId <= asIndex) continue
    for (const note of notes) {
      const at = indexOf.get(note.percussionArticulation)
      if (at === undefined) continue
      note.percussionArticulation = at
      repaired++
    }
  }
  return repaired
}
