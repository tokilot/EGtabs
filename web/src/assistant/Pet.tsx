import idle from './pet/idle.png'
import type { Mood } from './conversation.ts'
import styles from './Pet.module.css'

/**
 * The assistant's look: Rivus, a chibi girl with her deep green Stratocaster, created by jyi2ya
 * (https://github.com/jyi2ya) and used with permission (credited in the READMEs). Her frames are 16:9 pictures (the
 * framing her animation prompts ask for: standing in the middle, wide margins), cut down here to the girl herself.
 * For now one picture, pet/idle.png, held still (2026-11-18, the user's choice): her animations come later as
 * see-through webm videos with the same framing. Only drawn frames move: no effects are added over them.
 */
export function Pet({ mood }: { mood: Mood }) {
  return (
    <div className={styles.pet} aria-hidden="true" data-mood={mood}>
      <div className={styles.figure}>
        <img className={styles.picture} src={idle} alt="" draggable={false} />
      </div>
    </div>
  )
}
