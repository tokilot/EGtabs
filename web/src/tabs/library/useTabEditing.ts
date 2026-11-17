import { useCallback, useState } from 'react'
import * as api from '../api.ts'
import { usePlayer } from '../player/usePlayer.ts'
import { translate } from '../../shared/ui/i18n.ts'
import { useSong } from './useSong.ts'

/** Fired on window by the Ctrl+S shortcut. */
export const SAVE_EDITS_EVENT = 'tabs:save-edits'

/** Opening, saving, discarding and resetting tab edits for the open song. */
export function useTabEditing() {
  const { state, player } = usePlayer()
  const { song, replace, open, libraryChanged } = useSong()
  const [busy, setBusy] = useState(false)
  const editing = state.editing !== null

  const start = useCallback(() => player.startEditing(), [player])

  /** Stores the edited tab with the song (only when something changed) and closes the editor. */
  const save = useCallback(async () => {
    if (!song || !player.getSnapshot().editing) return
    if (!player.editDirty) {
      player.endEditing(false)
      return
    }
    const bytes = player.editedFile()
    if (!bytes) return
    setBusy(true)
    try {
      let saved = await api.saveEditedSong(song.id, bytes)
      // A title or artist changed in the editor goes to the library too, so the list shows it.
      const info = player.editedSongInfo()
      if (info) saved = await api.updateSong(song.id, info)
      replace(saved)
      player.endEditing(true)
      libraryChanged()
    } catch (cause) {
      window.alert(translate('保存失败：{message}', { message: (cause as Error).message }))
    } finally {
      setBusy(false)
    }
  }, [song, player, replace, libraryChanged])

  /** Closes the editor and throws away what was changed since it was opened. */
  const discard = useCallback(() => {
    if (player.editDirty && !window.confirm(translate('是否放弃修改？'))) return
    player.endEditing(false)
  }, [player])

  /** Deletes the saved edits and opens the tab as it was imported. */
  const restoreOriginal = useCallback(async () => {
    if (!song?.edited || !window.confirm(translate('是否放弃所有修改，恢复成导入时的曲谱？'))) return
    setBusy(true)
    try {
      player.endEditing(false)
      replace(await api.discardEditedSong(song.id))
      libraryChanged()
      await open(song.id)
    } finally {
      setBusy(false)
    }
  }, [song, player, replace, open, libraryChanged])

  return { editing, busy, start, save, discard, restoreOriginal, canEdit: state.status === 'ready' && song !== null }
}
