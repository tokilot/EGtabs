// What the assistant can do (2026-11-12), run here in the page where the tab is. Each tool says what it does in
// the model's terms (bars and tracks counted from 1, strings from the highest) and checks its arguments itself:
// a mistake goes back to the model as text it can correct, never as an exception. Every tool that changes
// something also gives a short line for the speech bubble, in the user's language, and the ones that change what
// the user keeps (tones, which tone a track plays) also say how to undo it.
import { toneFamilyOf, type Tone } from '../audio/tone.ts'
import { defaultChain } from '../audio/toneChain.ts'
import { translate } from '../shared/ui/i18n.ts'
import { SPEED_MAX, SPEED_MIN, TRANSPOSE_MAX, TRANSPOSE_MIN, type PlayerController } from '../tabs/player/controller.ts'
import { allTones, findTone, newToneId } from '../tones/library.ts'
import { toneStore } from '../tones/toneStore.ts'
import { EDIT_HELP, MAX_EDITS } from '../tabs/player/tabEdits.ts'
import { chainSummary, changeChain, isFamily, moduleCatalog } from './toneText.ts'

export interface ToolResult {
  /** For the model. */
  result: string
  /** For the speech bubble; none for tools that only read. */
  label?: string
  ok: boolean
  /** Puts back what the tool changed (tones, a track's tone); the bubble offers it for the whole answer. */
  undo?: () => void | Promise<void>
}

interface Tool {
  description: string
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
  run(args: Record<string, unknown>, player: PlayerController): ToolResult | Promise<ToolResult>
}

/** The most bars one read_bars call returns, so a long song is read a part at a time. */
export const MAX_BARS_PER_READ = 32

class ArgumentError extends Error {}

function integer(args: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = args[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ArgumentError(`"${key}" must be a number.`)
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) throw new ArgumentError(`"${key}" must be between ${min} and ${max}.`)
  return rounded
}

function boolean(args: Record<string, unknown>, key: string): boolean {
  const value = args[key]
  if (typeof value !== 'boolean') throw new ArgumentError(`"${key}" must be true or false.`)
  return value
}

const done = (result: string, label?: string, undo?: ToolResult['undo']): ToolResult => ({ result, label, ok: true, undo })

function text(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new ArgumentError(`"${key}" must be a non-empty string.`)
  return value.trim()
}

/** A tone of the library by id, or else by name (the model sometimes uses the name it was shown). */
function toneArg(args: Record<string, unknown>, key: string): Tone {
  const wanted = text(args, key)
  const tones = allTones(toneStore.getState().library)
  const tone = tones.find((item) => item.id === wanted) ?? tones.find((item) => item.name.toLowerCase() === wanted.toLowerCase())
  if (!tone) throw new ArgumentError(`There is no tone "${wanted}"; call list_tones for the ids.`)
  return tone
}

/** Saves a tone to the library (on the server); throws when it could not be saved. */
async function saveTone(tone: Tone) {
  await toneStore.save(tone)
  const error = toneStore.getState().error
  if (error) throw new ArgumentError(`The tone could not be saved: ${error}`)
}

function song(player: PlayerController) {
  const state = player.getSnapshot()
  if (state.status !== 'ready') throw new ArgumentError('No song is open (or it is still loading). Ask the user to open one.')
  return state
}

function barCount(player: PlayerController): number {
  return player.scoreOverview()?.bars ?? 0
}

const TOOLS: Record<string, Tool> = {
  get_song: {
    description:
      'The open song: title, tracks (number, name, instrument, tuning), bar count, where time signature / tempo / ' +
      'sections change, and the practice settings now (shown track, speed, loop, metronome, count-in, transposition).',
    parameters: { type: 'object', properties: {} },
    run(_args, player) {
      const state = song(player)
      const overview = player.scoreOverview()
      const range = state.range ? player.rangeBars() : null
      return done(
        JSON.stringify({
          ...overview,
          now: {
            shownTrack: state.trackIndex + 1,
            speedPercent: Math.round(state.speed * 100),
            loopBars: range ? `${range.from}-${range.to}` : 'whole song',
            looping: state.looping,
            metronome: state.metronome,
            countIn: state.countIn,
            transposeSemitones: state.transpose,
            playing: state.playing,
            editing: Boolean(state.editing),
          },
        }),
      )
    },
  },

  read_bars: {
    description:
      `The notes of bars from..to (inclusive, from 1) of a track, at most ${MAX_BARS_PER_READ} bars per call. ` +
      'One line per bar; beats as "n) duration string:fret(marks)", strings counted from the highest (1). ' +
      'Untransposed, as written.',
    parameters: {
      type: 'object',
      properties: {
        track: { type: 'integer', description: 'Track number, from 1.' },
        from: { type: 'integer', description: 'First bar, from 1.' },
        to: { type: 'integer', description: 'Last bar (inclusive).' },
      },
      required: ['track', 'from', 'to'],
    },
    run(args, player) {
      song(player)
      const overview = player.scoreOverview()!
      const track = integer(args, 'track', 1, overview.tracks.length)
      const from = integer(args, 'from', 1, overview.bars)
      const to = Math.min(integer(args, 'to', from, overview.bars), from + MAX_BARS_PER_READ - 1)
      return done(player.barsText(track - 1, from, to))
    },
  },

  set_speed: {
    description: `Playback speed in percent of the written tempo (${SPEED_MIN * 100}-${SPEED_MAX * 100}).`,
    parameters: { type: 'object', properties: { percent: { type: 'integer' } }, required: ['percent'] },
    run(args, player) {
      song(player)
      const percent = integer(args, 'percent', SPEED_MIN * 100, SPEED_MAX * 100)
      player.setSpeed(percent / 100)
      return done(`Speed is ${percent}%.`, translate('速度设为 {percent}%', { percent }))
    },
  },

  set_loop: {
    description: 'Selects bars from..to (inclusive, from 1) as the playback range and loops it.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'integer' }, to: { type: 'integer' } },
      required: ['from', 'to'],
    },
    run(args, player) {
      song(player)
      const bars = barCount(player)
      const from = integer(args, 'from', 1, bars)
      const to = integer(args, 'to', from, bars)
      if (!player.setBarRange(from, to)) throw new ArgumentError('The tab is still being drawn; try again in a moment.')
      player.setLooping(true)
      return done(`Looping bars ${from}-${to}.`, translate('循环第 {from}–{to} 小节', { from, to }))
    },
  },

  clear_loop: {
    description: 'Drops the selected range (the whole song plays again) and stops looping.',
    parameters: { type: 'object', properties: {} },
    run(_args, player) {
      song(player)
      player.clearRange()
      player.setLooping(false)
      return done('The whole song plays, without looping.', translate('取消循环'))
    },
  },

  set_metronome: {
    description: 'Turns the metronome (clicks following the song) on or off.',
    parameters: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    run(args, player) {
      song(player)
      const on = boolean(args, 'on')
      player.setMetronome(on)
      return done(`Metronome ${on ? 'on' : 'off'}.`, on ? translate('打开节拍器') : translate('关闭节拍器'))
    },
  },

  set_count_in: {
    description: 'Turns the count-in (a bar of clicks before playing) on or off.',
    parameters: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    run(args, player) {
      song(player)
      const on = boolean(args, 'on')
      player.setCountIn(on)
      return done(`Count-in ${on ? 'on' : 'off'}.`, on ? translate('打开预备拍') : translate('关闭预备拍'))
    },
  },

  set_transpose: {
    description: `Transposes playback and the shown tab by semitones (${TRANSPOSE_MIN} to ${TRANSPOSE_MAX}; 0 is as written). Not while the tab is being edited.`,
    parameters: { type: 'object', properties: { semitones: { type: 'integer' } }, required: ['semitones'] },
    run(args, player) {
      const state = song(player)
      if (state.editing) throw new ArgumentError('The tab is being edited; transposition can change after editing.')
      const semitones = integer(args, 'semitones', TRANSPOSE_MIN, TRANSPOSE_MAX)
      player.setTranspose(semitones)
      return done(`Transposed by ${semitones} semitones.`, translate('移调 {n} 个半音', { n: semitones }))
    },
  },

  show_track: {
    description: 'Shows (and follows) another track of the song.',
    parameters: { type: 'object', properties: { track: { type: 'integer', description: 'Track number, from 1.' } }, required: ['track'] },
    run(args, player) {
      const state = song(player)
      const track = integer(args, 'track', 1, state.tracks.length)
      player.selectTrack(track - 1)
      return done(`Showing track ${track}.`, translate('显示音轨 {track}', { track }))
    },
  },

  playback: {
    description: 'Plays, pauses, or goes back to the start; "bar" moves the position to the start of that bar first.',
    parameters: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['play', 'pause', 'stop'] }, bar: { type: 'integer' } },
      required: ['action'],
    },
    run(args, player) {
      const state = song(player)
      const action = args.action
      if (action !== 'play' && action !== 'pause' && action !== 'stop') throw new ArgumentError('"action" must be play, pause or stop.')
      if (action === 'stop') {
        player.toStart()
        return done('Stopped, back at the start.', translate('回到开头'))
      }
      if (args.bar !== undefined) player.seekToBar(integer(args, 'bar', 1, barCount(player)))
      if ((action === 'play') !== state.playing) player.playPause()
      return done(action === 'play' ? 'Playing.' : 'Paused.', action === 'play' ? translate('播放') : translate('暂停'))
    },
  },
}

const TONE_TOOLS: Record<string, Tool> = {
  list_tones: {
    description:
      "The user's effect tones (id, name, family: guitar or bass) and, for each track of the open song, the tone it " +
      'plays (null: the plain samples) and which family of tone it can take (null: none, e.g. drums or piano).',
    parameters: { type: 'object', properties: {} },
    run(_args, player) {
      const library = toneStore.getState().library
      const state = player.getSnapshot()
      return done(
        JSON.stringify({
          tones: allTones(library).map((tone) => ({ id: tone.id, name: tone.name, family: tone.family })),
          tracks:
            state.status === 'ready'
              ? state.tracks.map((track) => ({
                  track: track.index + 1,
                  name: track.name,
                  tone: findTone(library, state.trackTones[track.index])?.name ?? null,
                  takes: track.isPercussion ? null : toneFamilyOf(track.program),
                }))
              : 'no song is open',
        }),
      )
    },
  },

  tone_modules: {
    description:
      'The modules of a tone in signal order (dyna, filter, od = pedal, amp, cab, eq, mod, delay, reverb), their types, ' +
      'and their knobs with ranges and units. Knobs without a unit are 0-100. Read this before changing a tone.',
    parameters: { type: 'object', properties: {} },
    run: () => done(JSON.stringify(moduleCatalog())),
  },

  get_tone: {
    description: 'The chain of one tone: each module that is on with its type and knob values; the others "off".',
    parameters: { type: 'object', properties: { tone: { type: 'string', description: 'Tone id (or name).' } }, required: ['tone'] },
    run(args) {
      const tone = toneArg(args, 'tone')
      return done(JSON.stringify({ id: tone.id, name: tone.name, family: tone.family, chain: chainSummary(tone.chain) }))
    },
  },

  create_tone: {
    description:
      'Makes a new tone in the library: a copy of "based_on" (a tone id), or else the plain starting chain (amp and cab on) ' +
      'of "family". Then "changes" are made, as in change_tone. Returns the new id.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        family: { type: 'string', enum: ['guitar', 'bass'], description: 'Needed when there is no based_on.' },
        based_on: { type: 'string', description: 'Tone id to copy.' },
        changes: { type: 'object', description: 'Per module: {"on"?, "type"?, "knobs"?: {knob: value}}.' },
      },
      required: ['name'],
    },
    async run(args) {
      const name = text(args, 'name')
      const base = args.based_on === undefined || args.based_on === null ? null : toneArg(args, 'based_on')
      const family = base?.family ?? args.family
      if (!isFamily(family)) throw new ArgumentError('Give "family" (guitar or bass), or a tone to copy in "based_on".')
      let notes: string[] = []
      let chain = base ? structuredClone(base.chain) : defaultChain()
      if (args.changes !== undefined) ({ chain, notes } = changeChain(chain, args.changes))
      const tone: Tone = { id: newToneId(), name, family, chain }
      await saveTone(tone)
      return done(
        `Made tone ${tone.id} "${name}".${notes.length > 0 ? ` Note: ${notes.join('; ')}.` : ''}`,
        translate('新建音色「{name}」', { name }),
        () => toneStore.remove(tone.id),
      )
    },
  },

  change_tone: {
    description:
      'Changes a tone of the library, saved at once: its name and/or modules. "changes" per module: {"on"?: bool, ' +
      '"type"?: a type id, "knobs"?: {knob: value}}; changing a type or knob switches the module on. Only what is given changes.',
    parameters: {
      type: 'object',
      properties: {
        tone: { type: 'string', description: 'Tone id (or name).' },
        name: { type: 'string', description: 'A new name.' },
        changes: { type: 'object', description: 'Per module: {"on"?, "type"?, "knobs"?: {knob: value}}.' },
      },
      required: ['tone'],
    },
    async run(args) {
      const before = toneArg(args, 'tone')
      const name = args.name === undefined ? before.name : text(args, 'name')
      const { chain, notes } = args.changes === undefined ? { chain: before.chain, notes: [] as string[] } : changeChain(before.chain, args.changes)
      await saveTone({ ...before, name, chain })
      return done(
        `Changed tone ${before.id}; now ${JSON.stringify(chainSummary(chain))}.${notes.length > 0 ? ` Note: ${notes.join('; ')}.` : ''}`,
        translate('修改音色「{name}」', { name }),
        () => toneStore.save(before),
      )
    },
  },

  set_track_tone: {
    description:
      'Gives a track of the open song a tone (it then plays through that effect chain), or none (tone: null) for the ' +
      'plain samples. The tone must be of the family the track takes (see list_tones). Kept with the song.',
    parameters: {
      type: 'object',
      properties: { track: { type: 'integer' }, tone: { type: ['string', 'null'], description: 'Tone id (or name), or null.' } },
      required: ['track', 'tone'],
    },
    run(args, player) {
      const state = song(player)
      const track = integer(args, 'track', 1, state.tracks.length)
      const info = state.tracks[track - 1]
      const previousTone = state.trackTones[track - 1] ?? null
      const previousSound = state.trackSounds[track - 1] ?? null
      const undo = () => {
        player.setTrackTone(track - 1, previousTone)
        if (previousSound) player.setTrackSound(track - 1, previousSound)
      }
      if (args.tone === null) {
        player.setTrackTone(track - 1, null)
        return done(`Track ${track} plays its plain samples.`, translate('音轨 {track} 不用效果器音色', { track }), undo)
      }
      const tone = toneArg(args, 'tone')
      const takes = info.isPercussion ? null : toneFamilyOf(info.program)
      if (takes !== tone.family) {
        throw new ArgumentError(
          takes
            ? `Track ${track} takes ${takes} tones; "${tone.name}" is a ${tone.family} tone.`
            : `Track ${track} (${info.name}) is not an electric guitar or bass; the user can change its instrument in the track editor first.`,
        )
      }
      // A tone replaces an extra sound font's preset, as in the track editor.
      if (previousSound) player.setTrackSound(track - 1, null)
      player.setTrackTone(track - 1, tone.id)
      return done(`Track ${track} plays through "${tone.name}".`, translate('音轨 {track} 用音色「{name}」', { track, name: tone.name }), undo)
    },
  },
}

Object.assign(TOOLS, TONE_TOOLS)

/** Bars as "3", "3–5" or "3, 7–8", for the speech bubble. */
function barList(bars: number[]): string {
  const runs: string[] = []
  for (let index = 0; index < bars.length; index++) {
    let end = index
    while (end + 1 < bars.length && bars[end + 1] === bars[end] + 1) end++
    runs.push(end > index ? `${bars[index]}–${bars[end]}` : String(bars[index]))
    index = end
  }
  return runs.join(', ')
}

TOOLS.edit_tab = {
  description:
    'Edits the notes and bars of one track, with the tab editor (it opens if it is not open; the user saves or discards ' +
    'the edits there, and can undo them). All the edits of one call are one step of its undo. Read the bars first. ' +
    `${EDIT_HELP} Returns the edited bars as read_bars shows them.`,
  parameters: {
    type: 'object',
    properties: {
      track: { type: 'integer', description: 'Track number, from 1.' },
      edits: { type: 'array', items: { type: 'object' }, description: `1 to ${MAX_EDITS} operations.` },
    },
    required: ['track', 'edits'],
  },
  run(args, player) {
    const state = song(player)
    const track = integer(args, 'track', 1, state.tracks.length)
    const { outcome, error, step } = player.assistantEdit(track - 1, args.edits)
    const bars = outcome?.bars ?? []
    const parts: string[] = []
    if (error) parts.push(`Stopped: ${error}${step ? ' The edits before it were made.' : ' Nothing was changed.'}`)
    if (outcome) {
      parts.push(`${outcome.done} edits made.`)
      if (outcome.unbalanced.length > 0)
        parts.push(`These bars do not add up to their time signature: ${outcome.unbalanced.map((item) => `bar ${item.bar} is ${item.fill === 'short' ? 'too short' : 'too long'}`).join(', ')}.`)
      const shown = bars.slice(0, 8)
      if (shown.length > 0) parts.push(`Now:\n${shown.map((bar) => player.barsText(track - 1, bar, bar).split('\n')[1]).join('\n')}`)
    }
    parts.push('The edits are in the tab editor, not saved yet: the user saves them with its save button.')
    if (!step) return { result: parts.join('\n'), ok: false }
    const label = outcome && bars.length > 0 ? translate('修改音轨 {track} 第 {bars} 小节', { track, bars: barList(bars) }) : translate('修改音轨 {track}', { track })
    return {
      result: parts.join('\n'),
      label,
      ok: !error,
      undo: () => {
        if (!player.undoAssistantEdit(track - 1, step)) throw new Error(translate('无法撤销改动。'))
      },
    }
  },
}

/** The tools as the chat completions API takes them. */
export function toolDefinitions() {
  return Object.entries(TOOLS).map(([name, tool]) => ({
    type: 'function' as const,
    function: { name, description: tool.description, parameters: tool.parameters },
  }))
}

/** Runs one call of the model; anything wrong becomes a message for it. */
export async function runTool(name: string, rawArguments: string, player: PlayerController): Promise<ToolResult> {
  const tool = TOOLS[name]
  if (!tool) return { result: `There is no tool "${name}".`, ok: false }
  let args: unknown
  try {
    args = JSON.parse(rawArguments || '{}')
  } catch {
    return { result: 'The arguments are not valid JSON.', ok: false }
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return { result: 'The arguments must be an object.', ok: false }
  try {
    return await tool.run(args as Record<string, unknown>, player)
  } catch (error) {
    return { result: `Error: ${(error as Error).message}`, ok: false }
  }
}
