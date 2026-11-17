// The tab as plain text, for the assistant (2026-11-12): an overview of the song and its tracks, and the beats of a
// range of bars of one track. Bars and beats are numbered from 1 and strings the guitarist's way (1 is the highest),
// so what the model reads matches what the user sees and says. No player and no DOM: the controller hands the score.
import { model } from '@coderline/alphatab'

export interface ScoreOverview {
  title: string
  artist: string
  bars: number
  tempo: number
  tracks: Array<{ track: number; name: string; instrument: string; strings: number; tuning: string[]; capo: number }>
  /** Bars where the time signature, tempo or section changes (bar 1 always). */
  changes: string[]
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function pitchName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

/** The tuning as note names, highest string first (string 1). */
export function tuningNames(staff: model.Staff): string[] {
  return staff.tuning.map(pitchName)
}

export function scoreOverview(score: model.Score): ScoreOverview {
  const changes: string[] = []
  let signature = ''
  let tempo = score.tempo
  score.masterBars.forEach((bar, index) => {
    const parts: string[] = []
    const thisSignature = `${bar.timeSignatureNumerator}/${bar.timeSignatureDenominator}`
    if (thisSignature !== signature) parts.push(thisSignature)
    signature = thisSignature
    const barTempo = bar.tempoAutomations[0]?.value
    if (index === 0 || (barTempo !== undefined && barTempo !== tempo)) {
      tempo = barTempo ?? tempo
      parts.push(`${Math.round(tempo)} bpm`)
    }
    if (bar.section) parts.push(`section "${bar.section.text || bar.section.marker}"`)
    if (bar.isRepeatStart) parts.push('repeat start')
    if (bar.repeatCount > 0) parts.push(`repeat end x${bar.repeatCount}`)
    if (parts.length > 0) changes.push(`bar ${index + 1}: ${parts.join(', ')}`)
  })
  return {
    title: score.title,
    artist: score.artist,
    bars: score.masterBars.length,
    tempo: Math.round(score.tempo),
    tracks: score.tracks.map((track) => {
      const staff = track.staves[0]
      return {
        track: track.index + 1,
        name: track.name,
        instrument: staff.isPercussion ? 'drums' : `GM program ${track.playbackInfo.program}`,
        strings: staff.isPercussion ? 0 : staff.tuning.length,
        tuning: staff.isPercussion ? [] : tuningNames(staff),
        capo: staff.capo,
      }
    }),
    changes,
  }
}

const DURATION_NAMES: Record<number, string> = {
  [model.Duration.Whole]: '1',
  [model.Duration.Half]: '2',
  [model.Duration.Quarter]: '4',
  [model.Duration.Eighth]: '8',
  [model.Duration.Sixteenth]: '16',
  [model.Duration.ThirtySecond]: '32',
  [model.Duration.SixtyFourth]: '64',
}

function noteText(note: model.Note, strings: number): string {
  const string = strings - note.string + 1
  const marks: string[] = []
  if (note.isTieDestination) marks.push('tie')
  if (note.isDead) marks.push('dead')
  if (note.isGhost) marks.push('ghost')
  if (note.isHammerPullOrigin) marks.push('h/p')
  if (note.slideOutType !== model.SlideOutType.None) marks.push('slide')
  if (note.hasBend) marks.push('bend')
  if (note.vibrato !== model.VibratoType.None) marks.push('vib')
  if (note.harmonicType !== model.HarmonicType.None) marks.push('harm')
  if (note.isPalmMute) marks.push('pm')
  if (note.isLetRing) marks.push('ring')
  if (note.isStaccato) marks.push('stacc')
  return `${string}:${note.isDead ? 'x' : note.fret}${marks.length > 0 ? `(${marks.join(',')})` : ''}`
}

function beatText(beat: model.Beat, strings: number, percussion: boolean): string {
  let duration = DURATION_NAMES[beat.duration] ?? String(beat.duration)
  duration += '.'.repeat(beat.dots)
  if (beat.hasTuplet) duration += `[${beat.tupletNumerator}:${beat.tupletDenominator}]`
  if (beat.graceType !== model.GraceType.None) duration = `grace ${duration}`
  let body: string
  if (beat.isRest || beat.notes.length === 0) body = 'rest'
  // A drum note as the General MIDI key it plays: an index into the track's own list when it has one, else an id.
  else if (percussion) body = beat.notes.map((note) => `drum ${note.beat.voice.bar.staff.track.percussionArticulations[note.percussionArticulation]?.outputMidiNumber ?? note.percussionArticulation}`).join(' ')
  else body = [...beat.notes].sort((a, b) => b.string - a.string).map((note) => noteText(note, strings)).join(' ')
  const extras: string[] = []
  if (beat.chord?.name) extras.push(`chord "${beat.chord.name}"`)
  if (beat.text) extras.push(`text "${beat.text}"`)
  return `${beat.index + 1}) ${duration} ${body}${extras.length > 0 ? ` ${extras.join(' ')}` : ''}`
}

/**
 * Bars `from`..`to` (1-based, inclusive) of a track (0-based), one line per bar: its time signature and every beat
 * of the first voice as "n) duration string:fret(marks)…".
 */
export function barsText(score: model.Score, trackIndex: number, from: number, to: number): string {
  const track = score.tracks[trackIndex]
  if (!track) throw new Error(`There is no track ${trackIndex + 1}.`)
  const staff = track.staves[0]
  const strings = staff.tuning.length
  const first = Math.max(1, Math.floor(from))
  const last = Math.min(score.masterBars.length, Math.floor(to))
  if (first > last) throw new Error(`The song has bars 1 to ${score.masterBars.length}.`)
  const lines = [
    `Track ${trackIndex + 1} "${track.name}"${staff.isPercussion ? ' (drums)' : `, strings ${tuningNames(staff).join(' ')} (1 = highest)`}. ` +
      'Durations: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth; "." dotted; [n:m] tuplet. Notes are string:fret.',
  ]
  for (let index = first - 1; index < last; index++) {
    const master = score.masterBars[index]
    const beats = staff.bars[index].voices[0].beats
    lines.push(
      `bar ${index + 1} (${master.timeSignatureNumerator}/${master.timeSignatureDenominator}): ` +
        beats.map((beat) => beatText(beat, strings, staff.isPercussion)).join(' | '),
    )
  }
  return lines.join('\n')
}
