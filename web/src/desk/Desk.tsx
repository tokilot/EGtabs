// The desktop pet (2026-11-18): the assistant on its own, in a see-through window of the desktop app (desktop/), which
// loads this page (desk.html) from the app's server. It stays on the desktop, on top, until the app quits; the
// "practise" button (or a double click) opens the practice window, where the page shows no pet of its own. The
// conversation runs here. While the practice window is open its tools run there, with its tab and player
// (toolHost.ts), and performing shows the note names it plays; without it the pet can talk and work on tones.
// The window lets clicks through where nothing is drawn, moves when the pet is dragged, and has its menu on a right
// click; desktop/preload.cjs gives this page window.desk for that. Opened in a browser, there is none and it does nothing.
import { Guitar } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Assistant } from '../assistant/Assistant.tsx'
import { remoteHost, type HostRequest, type PlayerView } from '../assistant/toolHost.ts'
import { useLanguage } from '../shared/ui/i18n.ts'
import { KeyChoices, NoteNamesLine } from '../tabs/layout/NoteNames.tsx'
import { PlayerProvider } from '../tabs/player/PlayerContext.tsx'
import { toneStore } from '../tones/toneStore.ts'

/** What the desktop app's window offers this page (desktop/preload.cjs). */
interface DeskBridge {
  /** Whether the pointer is over something drawn: then the window takes clicks, else they go to the desktop. */
  setSolid(solid: boolean): void
  /** Moves the window by this much (screen pixels), while the pet is dragged. */
  moveBy(dx: number, dy: number): void
  /** The pet was let go: where the window is now is kept. */
  dragEnd(): void
  /** Opens the practice window (the app's page). */
  openPractice(): void
  /** The window's menu (right click). */
  showMenu(): void
  /** Whether the practice window is open and serving the pet's requests. */
  practiceOpen(): Promise<boolean>
  /** Called when the practice window opens (and serves) or closes; returns the unsubscribe. */
  onPractice(listener: (open: boolean) => void): () => void
  /** What the practice window plays, as it changes; returns the unsubscribe. */
  onView(listener: (view: PlayerView) => void): () => void
  /** A request to the practice window: its answer, or an error when it is closed or does not answer. */
  call(request: HostRequest): Promise<unknown>
}

const desk = (window as unknown as { desk?: DeskBridge }).desk

/** Below this many pixels a press is a click; past it, a drag. */
const DRAG_THRESHOLD = 4

export function Desk() {
  const { t } = useLanguage()
  const drag = useRef<{ x: number; y: number; moved: boolean; pointer: number } | null>(null)
  const dragged = useRef(false)
  const [practice, setPractice] = useState(false)
  const [view, setView] = useState<PlayerView | null>(null)

  // The practice window: whether it is open, and what it plays.
  useEffect(() => {
    if (!desk) return
    void desk.practiceOpen().then(setPractice)
    const stopPractice = desk.onPractice((open) => {
      setPractice(open)
      if (!open) setView(null)
    })
    const stopView = desk.onView(setView)
    return () => {
      stopPractice()
      stopView()
    }
  }, [])
  const host = useMemo(() => (practice && desk ? remoteHost((request) => desk.call(request)) : undefined), [practice])

  // The tone tools work on the tone library, as on the page.
  useEffect(() => void toneStore.load(), [])

  // Clicks go through the window where nothing is drawn: the page's background is html, body or #root.
  useEffect(() => {
    if (!desk) return
    let solid: boolean | null = null
    const onMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const now = drag.current !== null || !(target === document.documentElement || target === document.body || target?.id === 'root')
      if (now !== solid) desk.setSolid((solid = now))
    }
    const onMenu = (event: MouseEvent) => {
      event.preventDefault()
      desk.showMenu()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('contextmenu', onMenu)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('contextmenu', onMenu)
    }
  }, [])

  // Dragging the pet moves the window (by screen pixels: the window moves under the pointer).
  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const current = drag.current
      if (!current || event.pointerId !== current.pointer) return
      const dx = event.screenX - current.x
      const dy = event.screenY - current.y
      if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      current.moved = true
      current.x = event.screenX
      current.y = event.screenY
      desk?.moveBy(Math.round(dx), Math.round(dy))
    }
    const onUp = (event: globalThis.PointerEvent) => {
      const current = drag.current
      if (!current || event.pointerId !== current.pointer) return
      drag.current = null
      dragged.current = current.moved
      if (current.moved) desk?.dragEnd()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const onPetPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    dragged.current = false
    drag.current = { x: event.screenX, y: event.screenY, moved: false, pointer: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  return (
    <PlayerProvider>
      <Assistant
        host={host}
        // Performing needs the practice window's player: what plays, and the key it reads the names in.
        performance={
          practice && desk
            ? {
                names: <NoteNamesLine notes={view?.noteNames ?? null} playing={view?.playing ?? false} />,
                keys: (done) => (
                  <KeyChoices
                    tabKey={view?.noteNames?.tabKey ?? '1=C'}
                    manualKey={view?.manualKey ?? null}
                    transpose={view?.transpose ?? 0}
                    onPick={(key) => {
                      void desk.call({ kind: 'key', key })
                      done()
                    }}
                  />
                ),
              }
            : undefined
        }
        // One button, "practise": it opens the practice window, and once that is open it performs (2026-11-18).
        performButton={{ label: t('练琴'), icon: <Guitar size={15} aria-hidden="true" /> }}
        buttons={practice ? [] : [{ label: t('练琴'), icon: <Guitar size={15} aria-hidden="true" />, onClick: () => desk?.openPractice() }]}
        onPetPointerDown={onPetPointerDown}
        petWasDragged={() => {
          const was = dragged.current
          dragged.current = false
          return was
        }}
        onPetDoubleClick={() => desk?.openPractice()}
      />
    </PlayerProvider>
  )
}
