import { KEY_CHOICES, keyLabel, transposeKey, type NoteNames } from '../player/solfege.ts'
import { usePlayer } from '../player/usePlayer.ts'
import { useLanguage } from '../../shared/ui/i18n.ts'
import styles from './NoteNames.module.css'

/**
 * The solfège of the beat played, so the notes can be sung or named while practising (2026-11-18): shown by the pet
 * while it performs, at the upper right of its head, on no background, while the song plays; app/ hands it over.
 * The key they are read in is picked when performing starts (KeyPanel, from the pet's "perform" button). The parts
 * that only show what they are given (NoteNamesLine, KeyChoices) also serve the desktop pet, whose player is in the
 * practice window.
 */
export function NoteNamesText() {
  const { state } = usePlayer()
  return <NoteNamesLine notes={state.noteNames} playing={state.playing} />
}

/** The names, while the song plays; nothing otherwise. */
export function NoteNamesLine({ notes, playing }: { notes: NoteNames | null; playing: boolean }) {
  const { t } = useLanguage()
  if (!notes || !playing) return null
  return (
    <span className={styles.names} role="status" aria-label={t('当前唱名')}>
      {notes.percussion ? '—' : notes.names.join(' ')}
    </span>
  )
}

/** Which key the note names are read in, with this page's player. */
export function KeyPanel({ onPick }: { onPick: () => void }) {
  const { state, player } = usePlayer()
  return (
    <KeyChoices
      tabKey={state.noteNames?.tabKey ?? '1=C'}
      manualKey={state.manualKey}
      transpose={state.transpose}
      onPick={(key) => {
        player.setManualKey(key)
        onPick()
      }}
    />
  )
}

interface KeyChoicesProps {
  /** The tab's own key at the cursor ("1=G"). */
  tabKey: string
  manualKey: number | null
  transpose: number
  /** null: follow the tab. */
  onPick: (key: number | null) => void
}

/** The tab's own key, or one of the twelve major keys. */
export function KeyChoices({ tabKey, manualKey, transpose, onPick }: KeyChoicesProps) {
  const { t } = useLanguage()
  // A picked key is stored for the untransposed tab; what is shown is moved with the transposition.
  return (
    <div className={styles.keyPanel}>
      <button type="button" className={styles.keyFollow} aria-pressed={manualKey === null} onClick={() => onPick(null)}>
        {t('跟随谱子（{key}）', { key: tabKey })}
      </button>
      <div className={styles.keyGrid}>
        {KEY_CHOICES.map((key) => (
          <button key={key} type="button" aria-pressed={manualKey === key} onClick={() => onPick(key)}>
            {keyLabel(transposeKey(key, transpose))}
          </button>
        ))}
      </div>
    </div>
  )
}
