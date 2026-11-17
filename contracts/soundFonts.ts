// The player's sample sets as the server lists them (server/src/soundFonts.ts, web/src/tabs/player/trackSounds.ts).

export interface SoundFontPreset {
  program: number
  name: string
}

export interface SoundFont {
  name: string
  bytes: number
  /** A full General MIDI set, or a set of a few instruments. */
  kind: 'gm' | 'extra'
  /** The set the player loads at the start and plays the tabs' instruments with: the first General MIDI set. */
  main: boolean
  /** Every other set: the bank its presets are served in (it is loaded by hand, its presets picked per track). */
  bank?: number
  /** The presets of bank 0 that sound whole (not one side of a stereo pair); empty when the file cannot be read. */
  presets: SoundFontPreset[]
  /** The main set: the presets added to it (in a bank of their own), offered per track like an extra set's. */
  added?: { bank: number; presets: SoundFontPreset[] }
  /**
   * Its drum kits (2026-11-17), all played from the drum bank (128) by these programs: the main set's as they are,
   * another set's moved to programs the main set's kits do not use (the bytes served are changed to match).
   */
  drums?: SoundFontPreset[]
}
