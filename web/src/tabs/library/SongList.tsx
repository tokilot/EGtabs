import { Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as api from '../api.ts'
import type { Song } from '../api.ts'
import { translate, useLanguage } from '../../shared/ui/i18n.ts'
import { useSong } from './useSong.ts'
import { PlaylistPanel } from './PlaylistPanel.tsx'
import { SONG_ORDERS, sortSongs, storedSongOrder, storeSongOrder, type SongOrder } from './songOrder.ts'
import styles from './SongList.module.css'

interface SongListProps {
  /** Called after a song was picked, e.g. to close the surrounding popover. */
  onPick?: () => void
}

/**
 * "My tabs": everything in the library, with a favourites filter, newest first, oldest first or by the first letter
 * of the title (songOrder.ts); and the playlists, which keep their own order.
 */
export function SongList({ onPick }: SongListProps) {
  const { t } = useLanguage()
  const { song: current, open, close, replace, libraryVersion, libraryChanged } = useSong()
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [order, setOrder] = useState<SongOrder>(storedSongOrder)
  const [view, setView] = useState<'all' | 'favorites' | 'playlists'>('all')
  const favoritesOnly = view === 'favorites'
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (view === 'playlists') return
    let cancelled = false
    api
      .listSongs({ favorite: favoritesOnly })
      .then((list) => {
        if (cancelled) return
        setSongs(list)
        setError(null)
      })
      .catch((cause) => {
        if (!cancelled) setError((cause as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [view, favoritesOnly, libraryVersion])

  const toggleFavorite = async (song: Song) => {
    const updated = await api.updateSong(song.id, { favorite: !song.favorite })
    if (current?.id === updated.id) replace(updated)
    libraryChanged()
  }

  const pickOrder = (value: SongOrder) => {
    setOrder(value)
    storeSongOrder(value)
  }
  const shown = songs && sortSongs(songs, order)

  const remove = async (song: Song) => {
    if (!window.confirm(translate('是否删除「{title}」？', { title: song.title }))) return
    await api.deleteSong(song.id)
    if (current?.id === song.id) close()
    libraryChanged()
  }

  return (
    <div className={styles.list}>
      <div className={styles.filters} role="tablist" aria-label={t('筛选')}>
        <button type="button" role="tab" aria-selected={view === 'all'} onClick={() => setView('all')}>
          {t('全部')}
        </button>
        <button type="button" role="tab" aria-selected={view === 'favorites'} onClick={() => setView('favorites')}>
          {t('收藏')}
        </button>
        <button type="button" role="tab" aria-selected={view === 'playlists'} onClick={() => setView('playlists')}>
          {t('播放列表')}
        </button>
        {/* Playlists keep their own order. */}
        {view !== 'playlists' && (
          <select className={styles.order} aria-label={t('排序')} title={t('排序')} value={order} onChange={(event) => pickOrder(event.target.value as SongOrder)}>
            {SONG_ORDERS.map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === 'playlists' ? (
        <PlaylistPanel onPick={onPick} />
      ) : (
        <>

      {error && <p className={styles.message}>{error}</p>}
      {!error && songs?.length === 0 && (
        <p className={styles.message}>{favoritesOnly ? t('收藏为空。') : t('曲库为空。')}</p>
      )}

      <ul>
        {shown?.map((song) => (
          <li key={song.id} className={song.id === current?.id ? styles.current : undefined}>
            <button
              type="button"
              className={styles.open}
              onClick={() => {
                void open(song.id)
                onPick?.()
              }}
            >
              <span className={styles.title}>{song.title}</span>
              <span className={styles.artist}>
                {song.source === 'file' ? [song.artist, t('本地文件')].filter(Boolean).join(' · ') : song.artist}
              </span>
            </button>
            <button
              type="button"
              className={styles.icon}
              aria-label={song.favorite ? t('取消收藏') : t('收藏')}
              aria-pressed={song.favorite}
              title={song.favorite ? t('取消收藏') : t('收藏')}
              onClick={() => void toggleFavorite(song)}
            >
              <Star size={16} aria-hidden fill={song.favorite ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className={styles.icon} aria-label={t('删除')} title={t('删除')} onClick={() => void remove(song)}>
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
        </>
      )}
    </div>
  )
}
