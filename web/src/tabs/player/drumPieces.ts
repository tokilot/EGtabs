// The drum pieces the tab editor offers on a drum track (2026-11-17): alphaTab's own table of percussion
// articulations (PercussionMapper, which alphaTab does not export), copied with its ids, staff lines, MIDI keys
// and note heads, so a piece put in here is drawn and played exactly as one read from a file. A staff line is
// counted in half steps down from the top line of the five (0 is the top line, 3 the snare's space, -1 the space
// over the staff). A drum note holds an index into its track's percussionArticulations when the track has that
// list (Guitar Pro files), or else one of these ids (online tabs and MIDI imports): see drumArticulations.ts.
import { model } from '@coderline/alphatab'

const S = model.MusicFontSymbol
const T = model.TechniqueSymbolPlacement

export interface DrumPiece {
  /** alphaTab's articulation id (the value a note of a track without its own list holds). */
  id: number
  /** The name shown (Chinese, the key of the English one in i18n.ts). */
  name: string
  /** Staff line, in half steps down from the top line. */
  line: number
  /** The General MIDI drum key it plays. */
  midi: number
  /** alphaTab's element type (the instrument the articulation belongs to). */
  element: string
  heads: [number, number, number]
  technique?: [number, number]
}

const BLACK: [number, number, number] = [S.NoteheadBlack, S.NoteheadHalf, S.NoteheadWhole]
const X: [number, number, number] = [S.NoteheadXBlack, S.NoteheadXBlack, S.NoteheadXBlack]
const DIAMOND: [number, number, number] = [S.NoteheadDiamondWhite, S.NoteheadDiamondWhite, S.NoteheadDiamondWhite]
const HEAVY_X: [number, number, number] = [S.NoteheadHeavyX, S.NoteheadHeavyX, S.NoteheadHeavyX]
const HAT: [number, number, number] = [S.NoteheadHeavyXHat, S.NoteheadHeavyXHat, S.NoteheadHeavyXHat]
const TRIANGLE: [number, number, number] = [S.NoteheadTriangleUpBlack, S.NoteheadTriangleUpHalf, S.NoteheadTriangleUpWhole]
const TRIANGLE_BLACK: [number, number, number] = [S.NoteheadTriangleUpBlack, S.NoteheadTriangleUpBlack, S.NoteheadTriangleUpBlack]
const X_HALF: [number, number, number] = [S.NoteheadXBlack, S.NoteheadXHalf, S.NoteheadXWhole]
const CHOKE: [number, number] = [S.ArticStaccatoAbove, T.Outside]
const RETURN: [number, number] = [S.StringsUpBow, T.Outside]
const MUTED: [number, number] = [S.NoteheadParenthesis, T.Inside]

function piece(id: number, name: string, element: string, line: number, midi: number, heads: [number, number, number], technique?: [number, number]): DrumPiece {
  return { id, name, element, line, midi, heads, technique }
}

/** In alphaTab's order, which is also the order of the pieces sharing a line (digit keys 1, 2, 3…). */
export const DRUM_PIECES: DrumPiece[] = [
  piece(38, '小鼓', 'Snare', 3, 38, BLACK),
  piece(37, '边击小鼓', 'Snare', 3, 37, X),
  piece(91, '小鼓鼓边', 'Snare', 3, 38, DIAMOND),
  piece(42, '闭镲', 'Charley', -1, 42, X),
  piece(92, '半开镲', 'Charley', -1, 46, [S.NoteheadCircleSlash, S.NoteheadCircleSlash, S.NoteheadCircleSlash]),
  piece(46, '开镲', 'Charley', -1, 46, [S.NoteheadCircleX, S.NoteheadCircleX, S.NoteheadCircleX]),
  piece(44, '踩镲（脚踩）', 'Charley', 9, 44, X),
  piece(35, '底鼓 2', 'Acoustic Kick Drum', 8, 35, BLACK),
  piece(36, '底鼓', 'Kick Drum', 7, 36, BLACK),
  piece(50, '高音通鼓', 'Tom Very High', 1, 50, BLACK),
  piece(48, '中高音通鼓', 'Tom High', 2, 48, BLACK),
  piece(47, '中低音通鼓', 'Tom Medium', 4, 47, BLACK),
  piece(45, '低音通鼓', 'Tom Low', 5, 45, BLACK),
  piece(43, '高音落地通鼓', 'Tom Very Low', 6, 43, BLACK),
  piece(93, '叮叮镲（边缘）', 'Ride', 0, 51, X, [S.PictEdgeOfCymbal, T.Above]),
  piece(51, '叮叮镲', 'Ride', 0, 51, X),
  piece(53, '叮叮镲（镲帽）', 'Ride', 0, 53, DIAMOND),
  piece(94, '叮叮镲（止音）', 'Ride', 0, 51, X, CHOKE),
  piece(55, '水镲', 'Splash', -2, 55, X),
  piece(95, '水镲（止音）', 'Splash', -2, 55, X, CHOKE),
  piece(52, '中国镲', 'China', -3, 52, HAT),
  piece(96, '中国镲（止音）', 'China', -3, 52, HAT),
  piece(49, '强音镲', 'Crash High', -2, 49, HEAVY_X),
  piece(97, '强音镲（止音）', 'Crash High', -2, 49, HEAVY_X, CHOKE),
  piece(57, '强音镲 2', 'Crash Medium', -1, 57, HEAVY_X),
  piece(98, '强音镲 2（止音）', 'Crash Medium', -1, 57, HEAVY_X, CHOKE),
  piece(99, '低音牛铃', 'Cowbell Low', 1, 56, TRIANGLE),
  piece(100, '低音牛铃（尖端）', 'Cowbell Low', 1, 56, X_HALF),
  piece(56, '牛铃', 'Cowbell Medium', 0, 56, TRIANGLE),
  piece(101, '牛铃（尖端）', 'Cowbell Medium', 0, 56, X_HALF),
  piece(102, '高音牛铃', 'Cowbell High', -1, 56, TRIANGLE),
  piece(103, '高音牛铃（尖端）', 'Cowbell High', -1, 56, X_HALF),
  piece(77, '低音木鱼', 'Woodblock Low', -9, 77, TRIANGLE_BLACK),
  piece(76, '高音木鱼', 'Woodblock High', -10, 76, TRIANGLE_BLACK),
  piece(60, '高音邦戈鼓', 'Bongo High', -4, 60, BLACK),
  piece(104, '高音邦戈鼓（闷音）', 'Bongo High', -5, 60, BLACK, MUTED),
  piece(105, '高音邦戈鼓（拍击）', 'Bongo High', -6, 60, X),
  piece(61, '低音邦戈鼓', 'Bongo Low', -7, 61, BLACK),
  piece(106, '低音邦戈鼓（闷音）', 'Bongo Low', -8, 61, BLACK, MUTED),
  piece(107, '低音邦戈鼓（拍击）', 'Bongo Low', -16, 61, X),
  piece(66, '低音天巴鼓', 'Timbale Low', 10, 66, BLACK),
  piece(65, '高音天巴鼓', 'Timbale High', 9, 65, BLACK),
  piece(68, '低音阿哥哥铃', 'Agogo Low', 12, 68, BLACK),
  piece(67, '高音阿哥哥铃', 'Agogo High', 11, 67, BLACK),
  piece(64, '低音康加鼓', 'Conga Low', 17, 64, BLACK),
  piece(108, '低音康加鼓（拍击）', 'Conga Low', 16, 64, X),
  piece(109, '低音康加鼓（闷音）', 'Conga Low', 15, 64, BLACK, MUTED),
  piece(63, '高音康加鼓', 'Conga High', 14, 63, BLACK),
  piece(110, '高音康加鼓（拍击）', 'Conga High', 13, 63, X),
  piece(62, '高音康加鼓（闷音）', 'Conga High', 19, 62, BLACK, MUTED),
  piece(72, '低音哨', 'Whistle Low', -11, 72, BLACK),
  piece(71, '高音哨', 'Whistle High', -17, 71, BLACK),
  piece(73, '刮葫芦', 'Guiro', 38, 73, BLACK),
  piece(74, '刮葫芦（来回）', 'Guiro', 37, 74, BLACK),
  piece(86, '苏尔多鼓', 'Surdo', 36, 86, BLACK),
  piece(87, '苏尔多鼓（闷音）', 'Surdo', 35, 87, X, MUTED),
  piece(54, '铃鼓', 'Tambourine', 3, 54, TRIANGLE_BLACK),
  piece(111, '铃鼓（回击）', 'Tambourine', 2, 54, TRIANGLE_BLACK, [S.StringsUpBow, T.Above]),
  piece(112, '铃鼓（滚奏）', 'Tambourine', 1, 54, TRIANGLE_BLACK, [S.StringsDownBow, T.Above]),
  piece(113, '铃鼓（手击）', 'Tambourine', -7, 54, X),
  piece(79, '库伊卡鼓', 'Cuica', 30, 79, BLACK),
  piece(78, '库伊卡鼓（闷音）', 'Cuica', 29, 78, X),
  piece(58, '颤击器', 'Vibraslap', 28, 58, BLACK),
  piece(81, '三角铁', 'Triangle', 27, 81, BLACK),
  piece(80, '三角铁（闷音）', 'Triangle', 26, 80, X, MUTED),
  piece(114, '大鼓', 'Grancassa', 25, 43, BLACK),
  piece(115, '对镲', 'Piatti', 18, 49, BLACK),
  piece(116, '对镲（手击）', 'Piatti', 24, 49, X),
  piece(69, '卡巴萨', 'Cabasa', 23, 69, BLACK),
  piece(117, '卡巴萨（回）', 'Cabasa', 22, 69, BLACK, RETURN),
  piece(85, '响板', 'Castanets', 21, 85, BLACK),
  piece(75, '响棒', 'Claves', 20, 75, BLACK),
  piece(70, '左沙锤', 'Left Maraca', -12, 70, BLACK),
  piece(118, '左沙锤（回）', 'Left Maraca', -13, 70, BLACK, RETURN),
  piece(119, '右沙锤', 'Right Maraca', -14, 70, BLACK),
  piece(120, '右沙锤（回）', 'Right Maraca', -15, 70, BLACK, RETURN),
  piece(82, '沙筒', 'Shaker', -23, 82, BLACK),
  piece(122, '沙筒（回）', 'Shaker', -24, 82, BLACK, RETURN),
  piece(84, '音树', 'Bell Tree', -18, 53, BLACK),
  piece(123, '音树（回）', 'Bell Tree', -19, 53, BLACK, RETURN),
  piece(83, '串铃', 'Jingle Bell', -20, 53, BLACK),
  piece(124, '拍击琴身（拇指）', 'Golpe', -21, 62, [S.NoteheadNull, S.NoteheadNull, S.NoteheadNull], [S.GuitarGolpe, T.Below]),
  piece(125, '拍击琴身（手指）', 'Golpe', -22, 62, [S.NoteheadNull, S.NoteheadNull, S.NoteheadNull], [S.GuitarGolpe, T.Above]),
  piece(39, '拍手', 'Hand Clap', 3, 39, BLACK),
  piece(40, '电子小鼓', 'Electric Snare', 3, 40, BLACK),
  piece(31, '鼓棒', 'Sticks', 3, 40, [S.NoteheadSlashedBlack2, S.NoteheadSlashedBlack2, S.NoteheadSlashedBlack2]),
  piece(41, '低音落地通鼓', 'Very Low Floor Tom', 5, 41, BLACK),
  piece(59, '叮叮镲 2（边缘）', 'Ride Cymbal 2', 2, 59, X, [S.PictEdgeOfCymbal, T.Above]),
  piece(126, '叮叮镲 2', 'Ride Cymbal 2', 2, 59, X),
  piece(127, '叮叮镲 2（镲帽）', 'Ride Cymbal 2', 2, 59, DIAMOND),
  piece(29, '叮叮镲 2（止音）', 'Ride Cymbal 2', 2, 59, X, CHOKE),
  piece(30, '反向镲', 'Reverse Cymbal', -3, 49, X),
  piece(33, '节拍器', 'Metronome', 3, 37, X),
  piece(34, '节拍器（重音）', 'Metronome', 3, 38, [S.NoteheadBlack, S.NoteheadBlack, S.NoteheadBlack]),
]

const BY_ID = new Map(DRUM_PIECES.map((item) => [item.id, item]))

export function drumPieceById(id: number): DrumPiece | undefined {
  return BY_ID.get(id)
}

/** The lines a drum kit is written on (china over the staff down to the pedal hi-hat under it): always offered. */
export const KIT_LINES = { top: -3, bottom: 9 }

/**
 * What the edit panel offers (2026-11-17): a drum kit's pieces in three rows, drums, hi-hat and cymbals, each put on
 * the beat or taken off it with one click; the most used have a digit key. The other pieces of the table stay
 * playable and deletable where a tab has them.
 */
export const DRUM_PALETTE: Array<{ group: string; pieces: Array<{ id: number; key?: string }> }> = [
  {
    group: '鼓',
    pieces: [{ id: 36, key: '1' }, { id: 38, key: '2' }, { id: 37 }, { id: 91 }, { id: 50, key: '7' }, { id: 48, key: '8' }, { id: 47 }, { id: 45 }, { id: 43, key: '9' }],
  },
  { group: '踩镲', pieces: [{ id: 42, key: '3' }, { id: 92 }, { id: 46, key: '4' }, { id: 44, key: '5' }] },
  { group: '镲片', pieces: [{ id: 49, key: '6' }, { id: 57 }, { id: 51, key: '0' }, { id: 53 }, { id: 52 }, { id: 55 }] },
]

/** The piece a digit key puts on (or takes off) the beat. */
export function paletteKey(digit: string): number | null {
  for (const row of DRUM_PALETTE) for (const item of row.pieces) if (item.key === digit) return item.id
  return null
}

/** alphaTab's articulation for a piece, for adding it to a track's own list. */
export function articulationFor(item: DrumPiece): model.InstrumentArticulation {
  const [technique, placement] = item.technique ?? [S.None, T.Above]
  const articulation = new model.InstrumentArticulation(item.element, item.line, item.midi, item.heads[0], item.heads[1], item.heads[2], technique, placement)
  articulation.id = item.id
  return articulation
}

/** What a drum note on `track` plays: its entry in the track's own list, or the piece its id names. */
export function noteArticulation(track: model.Track, value: number): { line: number; midi: number; id: number } | null {
  if (value < 0) return null
  const list = track.percussionArticulations
  if (value < list.length) {
    const entry = list[value]
    return { line: entry.staffLine, midi: entry.outputMidiNumber, id: entry.id }
  }
  const known = BY_ID.get(value)
  return known ? { line: known.line, midi: known.midi, id: known.id } : null
}
