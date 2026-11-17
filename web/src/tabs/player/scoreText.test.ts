import { importer, Settings } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { barsText, pitchName, scoreOverview } from './scoreText.ts'

// Two bars of a guitar track in standard tuning: alphaTex writes fret.string with string 1 the highest.
const TEX = `\\title "Test" \\artist "Someone" \\tempo 90
.
\\track "Lead"
\\tuning E4 B3 G3 D3 A2 E2
:4 0.6 3.5 (2.3 0.2) r | \\ts 3 4 \\section "Solo" :8 5.1{h} 7.1 :4 x.6 :4 12.1{v}
`

describe('the tab as text for the assistant', () => {
  const score = importer.ScoreLoader.loadAlphaTex(TEX, new Settings())

  it('names pitches', () => {
    expect(pitchName(40)).toBe('E2')
    expect(pitchName(64)).toBe('E4')
    expect(pitchName(61)).toBe('C#4')
  })

  it('gives an overview with tracks, tunings and where things change', () => {
    const overview = scoreOverview(score)
    expect(overview).toMatchObject({ title: 'Test', artist: 'Someone', bars: 2, tempo: 90 })
    expect(overview.tracks).toEqual([{ track: 1, name: 'Lead', instrument: 'GM program 25', strings: 6, tuning: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'], capo: 0 }])
    expect(overview.changes).toEqual(['bar 1: 4/4, 90 bpm', 'bar 2: 3/4, section "Solo"'])
  })

  it('writes bars with strings counted from the highest, beats numbered from 1', () => {
    const lines = barsText(score, 0, 1, 2).split('\n')
    expect(lines[0]).toContain('strings E4 B3 G3 D3 A2 E2 (1 = highest)')
    expect(lines[1]).toBe('bar 1 (4/4): 1) 4 6:0 | 2) 4 5:3 | 3) 4 2:0 3:2 | 4) 4 rest')
    expect(lines[2]).toBe('bar 2 (3/4): 1) 8 1:5(h/p) | 2) 8 1:7 | 3) 4 6:x(dead) | 4) 4 1:12(vib)')
  })

  it('keeps the range inside the song and says why when it cannot', () => {
    expect(barsText(score, 0, 2, 99).split('\n')).toHaveLength(2)
    expect(() => barsText(score, 0, 5, 6)).toThrow('bars 1 to 2')
    expect(() => barsText(score, 3, 1, 1)).toThrow('no track 4')
  })
})
