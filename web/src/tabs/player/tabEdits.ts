// The assistant's edits to a tab (2026-11-12): a list of operations in the model's terms (bars and beats from 1,
// strings the guitarist's way, 1 the highest), carried out with the tab editor's own commands, so they are exactly
// what a user could do by hand and undo the same way. Each operation is checked first; a wrong one stops the list
// with an Error saying what is allowed (the ones before it stay done, as one step with them).
import { model } from '@coderline/alphatab'
import { MAX_FRET, TUPLETS, type BendKind, type Flag, type SlideKind, type TabEditor } from './tabEditor.ts'

export const NOTE_TECHNIQUES = ['hammer', 'dead', 'ghost', 'tie', 'staccato', 'pickScrape', 'leftHandTap'] as const
export const BEAT_TECHNIQUES = ['palmMute', 'letRing', 'tap', 'slap', 'pop', 'fermata'] as const
const SLIDES: SlideKind[] = ['none', 'legato', 'shift', 'inBelow', 'inAbove', 'outDown', 'outUp']
const BENDS: Array<Exclude<BendKind, 'custom'>> = ['none', 'half', 'full', 'oneAndHalf', 'bendRelease', 'preBend', 'preBendRelease']
const VIBRATOS: Record<string, model.VibratoType> = { none: model.VibratoType.None, slight: model.VibratoType.Slight, wide: model.VibratoType.Wide }
const DURATIONS = [1, 2, 4, 8, 16, 32, 64]
/** The most operations one call takes. */
export const MAX_EDITS = 64

/** The operations, as the model is told about them. */
export const EDIT_HELP =
  'Operations, applied in order (beat numbers mean the bar as it is at that point):\n' +
  '{"op":"note","bar","beat","string","fret"} sets the note on that string of the beat (adds it, or changes its fret; a rest becomes a note);\n' +
  '{"op":"remove_note","bar","beat","string"}; {"op":"rest","bar","beat"} removes every note of the beat;\n' +
  `{"op":"duration","bar","beat","value": 1|2|4|8|16|32|64, "dots"?: 0-2, "tuplet"?: 0|${Object.keys(TUPLETS).join('|')}};\n` +
  '{"op":"insert_beat","bar","beat"} adds a rest of the same length after that beat; {"op":"delete_beat","bar","beat"};\n' +
  `{"op":"technique","bar","beat","string"?,"name","on"?: bool} with note techniques ${NOTE_TECHNIQUES.join(', ')} (need "string") ` +
  `or beat techniques ${BEAT_TECHNIQUES.join(', ')}; "on" defaults to true;\n` +
  `{"op":"slide","bar","beat","string","kind": ${SLIDES.join('|')}}; {"op":"bend",…,"kind": ${BENDS.join('|')}}; {"op":"vibrato",…,"kind": none|slight|wide};\n` +
  '{"op":"chord","bar","beat","name"} ("" removes); {"op":"text","bar","beat","text"};\n' +
  '{"op":"insert_bar","bar"} adds an empty bar (rests) after that bar, in every track; {"op":"delete_bar","bar"} (every track);\n' +
  '{"op":"time_signature","bar","numerator","denominator"} from that bar on; {"op":"tempo","bar","bpm"} (null removes); {"op":"section","bar","text"} ("" removes).\n' +
  'The beats of a bar must add up to its time signature; the result says which bars do not.'

export interface EditOutcome {
  /** Operations carried out. */
  done: number
  /** The bars touched, 1-based, in order. */
  bars: number[]
  /** Bars whose beats do not add up to their time signature. */
  unbalanced: Array<{ bar: number; fill: 'short' | 'over' }>
}

type Op = Record<string, unknown>

function int(op: Op, key: string, min: number, max: number, index: number): number {
  const value = op[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`Edit ${index + 1}: "${key}" must be a whole number.`)
  if (value < min || value > max) throw new Error(`Edit ${index + 1}: "${key}" must be between ${min} and ${max}.`)
  return value
}

function oneOf<T extends string>(op: Op, key: string, allowed: readonly T[], index: number): T {
  const value = op[key]
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Edit ${index + 1}: "${key}" must be one of ${allowed.join(', ')}.`)
  return value as T
}

function string(op: Op, key: string, index: number): string {
  const value = op[key]
  if (typeof value !== 'string') throw new Error(`Edit ${index + 1}: "${key}" must be text.`)
  return value
}

/** Carries out the operations on the editor's track. Throws (with what was done so far kept) at the first wrong one. */
export function applyEdits(editor: TabEditor, edits: unknown): EditOutcome {
  if (!Array.isArray(edits) || edits.length === 0) throw new Error('"edits" must be a non-empty list of operations.')
  if (edits.length > MAX_EDITS) throw new Error(`At most ${MAX_EDITS} operations per call.`)
  // Drum tracks are edited in the tab editor by hand (2026-11-17); these operations are about strings and frets.
  if (editor.drums) throw new Error('This is a drum track: this tool edits tracks with strings only. The user can edit drums in the tab editor.')
  if (!editor.editable) throw new Error('This track has no strings and cannot be edited.')
  const touched = new Set<number>()
  let done = 0
  const strings = editor.stringCount

  edits.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Edit ${index + 1} must be an object.`)
    const op = raw as Op
    const bars = editor.score.masterBars.length
    const bar = int(op, 'bar', 1, bars, index) - 1
    const beatCount = () => editor.staff.bars[bar].voices[0].beats.length
    const at = (withString: boolean) => {
      const beat = int(op, 'beat', 1, beatCount(), index) - 1
      const target: { bar: number; beat: number; string?: number } = { bar, beat }
      if (withString) target.string = strings - int(op, 'string', 1, strings, index) + 1
      editor.moveTo(target)
    }
    const needNote = () => {
      if (!editor.note) throw new Error(`Edit ${index + 1}: there is no note on string ${op.string as number} of bar ${bar + 1}, beat ${op.beat as number}.`)
    }
    touched.add(bar + 1)

    switch (op.op) {
      case 'note':
        at(true)
        editor.setFret(int(op, 'fret', 0, MAX_FRET, index))
        break
      case 'remove_note':
        at(true)
        needNote()
        editor.removeNote()
        break
      case 'rest':
        at(false)
        editor.clearBeat()
        break
      case 'duration': {
        at(false)
        const value = op.value
        if (typeof value !== 'number' || !DURATIONS.includes(value)) throw new Error(`Edit ${index + 1}: "value" must be one of ${DURATIONS.join(', ')}.`)
        editor.setDuration(value as model.Duration)
        if (op.dots !== undefined) editor.setDots(int(op, 'dots', 0, 2, index))
        if (op.tuplet !== undefined) {
          const tuplet = op.tuplet
          if (typeof tuplet !== 'number' || (tuplet !== 0 && !TUPLETS[tuplet])) throw new Error(`Edit ${index + 1}: "tuplet" must be 0 or one of ${Object.keys(TUPLETS).join(', ')}.`)
          if ((editor.state().beat.tuplet || 0) !== tuplet) editor.setTuplet(tuplet)
        }
        break
      }
      case 'insert_beat':
        at(false)
        editor.insertBeat()
        break
      case 'delete_beat':
        at(false)
        editor.deleteBeat()
        break
      case 'technique': {
        const name = oneOf(op, 'name', [...NOTE_TECHNIQUES, ...BEAT_TECHNIQUES], index)
        const on = op.on === undefined ? true : op.on
        if (typeof on !== 'boolean') throw new Error(`Edit ${index + 1}: "on" must be true or false.`)
        const forNote = (NOTE_TECHNIQUES as readonly string[]).includes(name)
        at(forNote)
        let now: boolean
        if (forNote) {
          needNote()
          now = editor.state().note!.flags[name as (typeof NOTE_TECHNIQUES)[number]]
        } else {
          if ((name === 'palmMute' || name === 'letRing') && editor.beat.notes.length === 0) throw new Error(`Edit ${index + 1}: ${name} needs a beat with notes.`)
          now = editor.state().beat.flags[name as (typeof BEAT_TECHNIQUES)[number]]
        }
        if (now !== on) editor.toggle(name as Flag)
        break
      }
      case 'slide':
        at(true)
        needNote()
        editor.setSlide(oneOf(op, 'kind', SLIDES, index))
        break
      case 'bend':
        at(true)
        needNote()
        editor.setBend(oneOf(op, 'kind', BENDS, index))
        break
      case 'vibrato':
        at(true)
        needNote()
        editor.setVibrato(VIBRATOS[oneOf(op, 'kind', Object.keys(VIBRATOS), index)])
        break
      case 'chord':
        at(false)
        editor.setChord(string(op, 'name', index))
        break
      case 'text':
        at(false)
        editor.setText(string(op, 'text', index))
        break
      case 'insert_bar':
        editor.moveTo({ bar, beat: 0 })
        editor.insertBar()
        touched.add(bar + 2)
        break
      case 'delete_bar':
        if (bars <= 1) throw new Error(`Edit ${index + 1}: the last bar of the song stays.`)
        editor.moveTo({ bar, beat: 0 })
        editor.deleteBar()
        touched.delete(bar + 1)
        break
      case 'time_signature': {
        const numerator = int(op, 'numerator', 1, 32, index)
        const denominator = op.denominator
        if (typeof denominator !== 'number' || ![1, 2, 4, 8, 16, 32].includes(denominator)) throw new Error(`Edit ${index + 1}: "denominator" must be 1, 2, 4, 8, 16 or 32.`)
        editor.moveTo({ bar, beat: 0 })
        editor.setTimeSignature(numerator, denominator)
        break
      }
      case 'tempo':
        editor.moveTo({ bar, beat: 0 })
        editor.setTempo(op.bpm === null ? null : int(op, 'bpm', 10, 400, index))
        break
      case 'section':
        editor.moveTo({ bar, beat: 0 })
        editor.setSection(string(op, 'text', index))
        break
      default:
        throw new Error(`Edit ${index + 1}: there is no operation "${String(op.op)}".`)
    }
    done++
  })

  const total = editor.score.masterBars.length
  const bars = [...touched].filter((bar) => bar >= 1 && bar <= total).sort((a, b) => a - b)
  const unbalanced: EditOutcome['unbalanced'] = []
  for (const bar of bars) {
    editor.moveTo({ bar: bar - 1, beat: 0 })
    const fill = editor.state().barFill
    if (fill !== 'full') unbalanced.push({ bar, fill })
  }
  return { done, bars, unbalanced }
}
