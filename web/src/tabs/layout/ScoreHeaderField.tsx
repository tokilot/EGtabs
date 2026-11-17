import { useState } from 'react'
import type { Box } from '../player/controller.ts'
import styles from './ScoreView.module.css'

/**
 * The song's title or artist where the score shows it (2026-11-17), editable while the tab editor is open: laid
 * over the text alphaTab drew, in the same place and size, with a dashed line under it. Enter or leaving it keeps
 * the change (the score is drawn again with it), Escape brings back what was there.
 */
export function ScoreHeaderField({ box, value, label, bold, onCommit }: { box: Box; value: string; label: string; bold?: boolean; onCommit: (value: string) => void }) {
  // An empty one (no artist yet) shows what it is for.
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(value)
  }
  const width = Math.max(box.w + 48, 220)
  const commit = () => {
    if (text.trim() !== value) onCommit(text)
    else setText(value)
  }
  return (
    <input
      type="text"
      className={styles.headerField}
      aria-label={label}
      title={label}
      placeholder={label}
      value={text}
      style={{
        left: box.x + box.w / 2 - width / 2,
        top: box.y - 2,
        width,
        height: box.h + 4,
        fontSize: box.h * 0.82,
        fontWeight: bold ? 700 : 400,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        if (event.key === 'Escape') {
          setText(value)
          setShown(value)
          ;(event.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
