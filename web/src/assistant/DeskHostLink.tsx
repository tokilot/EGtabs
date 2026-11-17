// The practice window of the desktop app (2026-11-18): the pet lives on the desktop, not on this page, and asks this
// page to run its tools (toolHost.ts). This serves those requests with the page's player and tells the pet what
// plays, for performing. Only in the desktop app (desktop/practice.cjs gives the page window.deskHost); app/ puts it
// where the pet would be.
import { useEffect } from 'react'
import { usePlayer } from '../tabs/player/usePlayer.ts'
import { createHostServer, deskHost, playerView, type PlayerView } from './toolHost.ts'

export function DeskHostLink() {
  // Re-rendered with every change of the player's state (usePlayer subscribes).
  const { player } = usePlayer()
  const host = deskHost()

  useEffect(() => host?.serve(createHostServer(player)), [host, player])

  const view = playerView(player)
  const key = JSON.stringify(view)
  // Sent when it changes (the note names change with the beats played).
  useEffect(() => host?.publish(JSON.parse(key) as PlayerView), [host, key])
  return null
}
