import { Drum, Guitar, Headphones, Pencil, Plus, Volume2, VolumeX } from 'lucide-react'
import { useState } from 'react'
import * as api from '../api.ts'
import { useSong } from '../library/useSong.ts'
import { sortByName } from '../../shared/alphabetical.ts'
import { useLanguage } from '../../shared/ui/i18n.ts'
import { Popover } from '../../shared/ui/Popover.tsx'
import { programName } from './gmPrograms.ts'
import { InstrumentIcon } from './InstrumentIcon.tsx'
import { openTrackEditor } from './trackEditorStore.ts'
import { usePlayer } from './usePlayer.ts'
import styles from './TrackList.module.css'

/**
 * Track picker and mixer: the master volume, then each track with a dot that blinks while it is sounding,
 * its volume, solo, mute and the track editor.
 */
export function TrackList() {
  const { state, player } = usePlayer()
  const { t, language } = useLanguage()
  const { song, replace, libraryChanged } = useSong()
  const [adding, setAdding] = useState(false)
  const [addMenu, setAddMenu] = useState(false)
  if (state.tracks.length === 0) return <p className={styles.empty}>{t('未打开任何曲谱。')}</p>

  // A new empty track at the end (2026-11-17), a guitar or a drum track, saved at once as the song's edited tab, like
  // deleting one; the track editor opens on it to pick its instrument and tuning (or drum kit).
  const addTrack = async (drums: boolean) => {
    setAddMenu(false)
    const score = player.trackAdditionScore(drums ? t('鼓') : t('新音轨'), drums)
    const bytes = score && player.trackAdditionFile(score)
    if (!song || !score || !bytes) return
    setAdding(true)
    try {
      replace(await api.saveEditedSong(song.id, bytes))
      const index = player.addTrack(score)
      libraryChanged()
      openTrackEditor(index)
    } catch (cause) {
      window.alert(t('保存失败：{message}', { message: (cause as Error).message }))
    } finally {
      setAdding(false)
    }
  }
  const sounding = new Set(state.sounding)

  return (
    <div className={styles.mixer}>
      <label className={styles.master}>
        <Volume2 size={16} aria-hidden />
        <span>{t('主音量')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.masterVolume}
          aria-label={t('主音量')}
          onChange={(event) => player.setMasterVolume(Number(event.target.value))}
        />
        <output>{Math.round(state.masterVolume * 100)}%</output>
      </label>

      <ul className={styles.tracks}>
        {/* By first letter (2026-11-10); the score keeps its own track order. */}
        {sortByName(state.tracks, (track) => track.name).map((track) => {
          const selected = track.index === state.trackIndex
          const isSounding = sounding.has(track.index)
          return (
            <li key={track.index} className={selected ? styles.selected : undefined}>
              <span
                className={styles.dot}
                data-sounding={isSounding || undefined}
                aria-label={isSounding ? t('正在发声') : undefined}
              />
              <button
                type="button"
                className={styles.name}
                aria-current={selected ? 'true' : undefined}
                title={track.isPercussion ? undefined : programName(track.program, language)}
                onClick={() => player.selectTrack(track.index)}
              >
                <InstrumentIcon program={track.program} isPercussion={track.isPercussion} />
                <span>{track.name}</span>
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={track.volume}
                aria-label={t('{name} 音量', { name: track.name })}
                onChange={(event) => player.setTrackVolume(track.index, Number(event.target.value))}
              />
              <button
                type="button"
                className={styles.toggle}
                aria-label={t('{name} 独奏', { name: track.name })}
                aria-pressed={track.solo}
                title={t('独奏')}
                onClick={() => player.setTrackSolo(track.index, !track.solo)}
              >
                <Headphones size={15} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.toggle}
                aria-label={t('{name} 静音', { name: track.name })}
                aria-pressed={track.mute}
                title={t('静音')}
                onClick={() => player.setTrackMute(track.index, !track.mute)}
              >
                <VolumeX size={15} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.toggle}
                aria-label={t('编辑 {name}', { name: track.name })}
                title={t('编辑音轨')}
                onClick={() => openTrackEditor(track.index)}
              >
                <Pencil size={14} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
      <Popover
        open={addMenu}
        onClose={() => setAddMenu(false)}
        placement="above"
        label={t('新建音轨')}
        trigger={
          <button
            type="button"
            className={styles.addTrack}
            disabled={adding || !song || state.status !== 'ready' || state.editing !== null}
            title={state.editing ? t('编辑曲谱时不能新建音轨') : t('新建音轨')}
            aria-expanded={addMenu}
            onClick={() => setAddMenu(!addMenu)}
          >
            <Plus size={15} aria-hidden />
            {t('新建音轨')}
          </button>
        }
      >
        <div className={styles.addMenu}>
          <button type="button" onClick={() => void addTrack(false)}>
            <Guitar size={15} aria-hidden />
            {t('吉他轨')}
          </button>
          <button type="button" onClick={() => void addTrack(true)}>
            <Drum size={15} aria-hidden />
            {t('鼓轨')}
          </button>
        </div>
      </Popover>
    </div>
  )
}
