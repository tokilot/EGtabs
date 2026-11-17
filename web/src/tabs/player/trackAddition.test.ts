import { importer, model, Settings } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { barsText } from './scoreText.ts'
import { TabEditor } from './tabEditor.ts'
import { NEW_TRACK_PROGRAM, withNewTrack } from './trackEdits.ts'

const TEX = `\\title "Add"
.
\\track "Lead"
\\tuning E4 B3 G3 D3 A2 E2
:4 0.6 3.5 2.3 r | \\ts 3 4 :4 5.1 7.1 8.1
\\track "Drums"
\\instrument percussion
\\tuning piano
:4 r r r r | r r r
`

describe('a new track', () => {
  it('is an empty six-string guitar at the end, rests filling every bar, on channels no track uses', () => {
    const settings = new Settings()
    const score = importer.ScoreLoader.loadAlphaTex(TEX, settings)
    const added = withNewTrack(score, settings, 'New track')
    expect(score.tracks).toHaveLength(2)
    expect(added.tracks).toHaveLength(3)
    const track = added.tracks[2]
    expect(track.name).toBe('New track')
    expect(track.isPercussion).toBe(false)
    expect(track.playbackInfo.program).toBe(NEW_TRACK_PROGRAM)
    const used = added.tracks.slice(0, 2).flatMap((item) => [item.playbackInfo.primaryChannel, item.playbackInfo.secondaryChannel])
    for (const channel of [track.playbackInfo.primaryChannel, track.playbackInfo.secondaryChannel]) {
      expect(used).not.toContain(channel)
      expect(channel).not.toBe(9)
    }
    expect(track.staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40])
    expect(barsText(added, 2, 1, 2).split('\n').slice(1)).toEqual(['bar 1 (4/4): 1) 1 rest', 'bar 2 (3/4): 1) 2 rest | 2) 4 rest'])
    // The tracks there were are as they were.
    expect(barsText(added, 0, 1, 2)).toBe(barsText(score, 0, 1, 2))
  })

  it('can be a drum track instead: the drum channel, no strings, editable on its staff', () => {
    const settings = new Settings()
    const score = importer.ScoreLoader.loadAlphaTex(TEX, settings)
    const added = withNewTrack(score, settings, 'Drums 2', true)
    const track = added.tracks[2]
    expect(track.isPercussion).toBe(true)
    expect([track.playbackInfo.primaryChannel, track.playbackInfo.secondaryChannel, track.playbackInfo.program]).toEqual([9, 9, 0])
    expect(track.staves[0].tuning).toEqual([])
    expect(track.staves[0].showTablature).toBe(false)
    expect(track.staves[0].bars.every((bar) => bar.clef === model.Clef.Neutral)).toBe(true)
    expect(barsText(added, 2, 1, 2).split('\n').slice(1)).toEqual(['bar 1 (4/4): 1) 1 rest', 'bar 2 (3/4): 1) 2 rest | 2) 4 rest'])
    // A kick and a snare on its first beat play as such.
    const editor = new TabEditor(added, 2, settings)
    editor.typeDigit(1)
    editor.typeDigit(2)
    expect(editor.beat.notes.map((note) => note.realValue).sort()).toEqual([36, 38])
  })
})
