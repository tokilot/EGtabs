// Where the pet stands on the page (2026-11-18): dragged anywhere, so it does not hide the bars being read; kept in
// the browser. The whole corner (the pet with its bubble and input box) moves and always stays in the window, above
// the control bar. Until it is first moved it stands in the bottom-left corner (Assistant.module.css).
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

const STORAGE_KEY = 'tabs.petPlace'
/** Below this many pixels a press is a click; past it, a drag. */
const DRAG_THRESHOLD = 4
/** Room kept between the corner and the window's sides (as in its first place, 12 px from the left). */
const EDGE = 12
/** How much of the corner's height (the pet and its buttons, from the bottom) stays in the window. */
const KEEP_VISIBLE = 190

interface Place {
  left: number
  bottom: number
}

function stored(): Place | null {
  try {
    const place = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Place | null
    return place && Number.isFinite(place.left) && Number.isFinite(place.bottom) ? place : null
  } catch {
    return null
  }
}

function store(place: Place) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place))
  } catch {
    // Not kept; still used for now.
  }
}

/** The place moved into the window: the corner's full width, and the pet between the control bar and the top. */
function fit(place: Place, corner: HTMLElement | null): Place {
  const width = corner?.offsetWidth ?? 0
  const controlBar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--controlbar-height')) || 0
  const lowest = controlBar + 8
  return {
    left: Math.round(Math.min(Math.max(EDGE, place.left), Math.max(EDGE, window.innerWidth - width - EDGE))),
    bottom: Math.round(Math.min(Math.max(lowest, place.bottom), Math.max(lowest, window.innerHeight - KEEP_VISIBLE))),
  }
}

/**
 * Dragging the pet moves the corner. Returns the corner's position (none until it was moved), the pet's press
 * handler, and whether the press that just ended was a drag (then it was no click).
 */
export function usePetPlace(corner: RefObject<HTMLElement | null>) {
  const [place, setPlace] = useState<Place | null>(stored)
  const drag = useRef<{ x: number; y: number; from: Place; pointer: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  // Back into the window when it gets smaller, and once the corner can be measured.
  useEffect(() => {
    const refit = () => setPlace((current) => current && fit(current, corner.current))
    refit()
    window.addEventListener('resize', refit)
    return () => window.removeEventListener('resize', refit)
  }, [corner])

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const current = drag.current
      if (!current || event.pointerId !== current.pointer) return
      const dx = event.clientX - current.x
      const dy = event.clientY - current.y
      if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      current.moved = true
      setPlace(fit({ left: current.from.left + dx, bottom: current.from.bottom - dy }, corner.current))
    }
    const onUp = (event: globalThis.PointerEvent) => {
      const current = drag.current
      if (!current || event.pointerId !== current.pointer) return
      drag.current = null
      dragged.current = current.moved
      if (current.moved) setPlace((now) => (now && store(now), now))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [corner])

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const element = corner.current
    if (event.button !== 0 || !element) return
    const box = element.getBoundingClientRect()
    dragged.current = false
    drag.current = { x: event.clientX, y: event.clientY, from: { left: box.left, bottom: window.innerHeight - box.bottom }, pointer: event.pointerId, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const wasDragged = () => {
    const was = dragged.current
    dragged.current = false
    return was
  }

  return { style: place ? { left: place.left, bottom: place.bottom } : undefined, onPointerDown, wasDragged }
}
