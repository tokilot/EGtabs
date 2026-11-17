// How "my tabs" lists the library (2026-11-17): newest first, oldest first, or by the first letter of the title. A song's
// date is when its tab last changed (saved from the editor, put back as imported, another revision), or else when it
// came into the library. The choice is kept in the browser and serves both "all" and "favourites".
import type { Song } from '../api.ts'
import { sortByName } from '../../shared/alphabetical.ts'

export type SongOrder = 'newest' | 'oldest' | 'name'

/** The choices, in the order offered, with their labels. */
export const SONG_ORDERS: Array<[SongOrder, string]> = [
  ['newest', '按最新日期'],
  ['oldest', '按最后日期'],
  ['name', '按首字母'],
]

const STORAGE_KEY = 'tabs.songOrder'

export function storedSongOrder(): SongOrder {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (SONG_ORDERS.some(([order]) => order === stored)) return stored as SongOrder
  } catch {
    // No storage: the default.
  }
  return 'name'
}

export function storeSongOrder(order: SongOrder) {
  try {
    localStorage.setItem(STORAGE_KEY, order)
  } catch {
    // Not kept; still used for now.
  }
}

/** When a song last changed: its tab, or else its coming into the library. */
export function songDate(song: Pick<Song, 'modifiedAt' | 'createdAt'>): string {
  return song.modifiedAt ?? song.createdAt
}

export function sortSongs<T extends Pick<Song, 'id' | 'title' | 'artist' | 'modifiedAt' | 'createdAt'>>(songs: T[], order: SongOrder): T[] {
  if (order === 'name') return sortByName(songs, (song) => `${song.title} ${song.artist}`)
  const direction = order === 'newest' ? -1 : 1
  // Same date (songs added together): the one added later counts as newer.
  return [...songs].sort((a, b) => direction * (songDate(a).localeCompare(songDate(b)) || a.id - b.id))
}
