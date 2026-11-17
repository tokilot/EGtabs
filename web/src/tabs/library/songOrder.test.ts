import { describe, expect, it } from 'vitest'
import { sortSongs } from './songOrder.ts'

const song = (id: number, title: string, createdAt: string, modifiedAt: string | null = null) => ({ id, title, artist: '', createdAt, modifiedAt })

describe('the order of my tabs', () => {
  const songs = [
    song(1, 'Beta', '2026-11-01T00:00:00.000Z'),
    // Added first, but its tab was changed last.
    song(2, 'Alpha', '2026-10-01T00:00:00.000Z', '2026-11-15T00:00:00.000Z'),
    song(3, 'Gamma', '2026-11-10T00:00:00.000Z'),
  ]

  it('puts the latest change (or else addition) first, or last', () => {
    expect(sortSongs(songs, 'newest').map((item) => item.id)).toEqual([2, 3, 1])
    expect(sortSongs(songs, 'oldest').map((item) => item.id)).toEqual([1, 3, 2])
  })

  it('goes by the first letter of the title', () => {
    expect(sortSongs(songs, 'name').map((item) => item.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('takes songs with the same date by when they were added', () => {
    const same = [song(5, 'A', '2026-11-01T00:00:00.000Z'), song(4, 'B', '2026-11-01T00:00:00.000Z')]
    expect(sortSongs(same, 'newest').map((item) => item.id)).toEqual([5, 4])
    expect(sortSongs(same, 'oldest').map((item) => item.id)).toEqual([4, 5])
  })
})
