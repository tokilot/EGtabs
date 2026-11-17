import { Check, ChevronDown, MessageSquare, Music, RotateCcw, Send, Settings, Square, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useLanguage } from '../shared/ui/i18n.ts'
import { Popover } from '../shared/ui/Popover.tsx'
import { usePlayer } from '../tabs/player/usePlayer.ts'
import { ask, loadStatus, newConversation, stop, undoAnswer, useAssistant } from './conversation.ts'
import { Pet } from './Pet.tsx'
import { usePetPlace } from './petPlace.ts'
import { playerHost, type ToolHost } from './toolHost.ts'
import { PetSettings } from './PetSettings.tsx'
import styles from './Assistant.module.css'

const PERFORMING_KEY = 'tabs.petPerforming'

function storedPerforming(): boolean {
  try {
    return localStorage.getItem(PERFORMING_KEY) === '1'
  } catch {
    return false
  }
}

function storePerforming(on: boolean) {
  try {
    if (on) localStorage.setItem(PERFORMING_KEY, '1')
    else localStorage.removeItem(PERFORMING_KEY)
  } catch {
    // Not kept; still used for now.
  }
}

/**
 * The assistant in the bottom-left corner, above the control bar (2026-11-12): the pet, under its feet the input
 * box, and its speech bubble at the upper right of its head (the answer, in the style of a comic; long answers
 * scroll), its right edge on the input box's. Clicking the pet shows (and hides) three icon buttons over its head:
 * the settings (its personality, data/assistant.md), the input box, and performing (2026-11-18): while it performs
 * there is no chatting, and in the bubble's place, on no background, are the note names (`performance`, which app/
 * hands over). Starting to perform opens the key menu by the button; a second click stops. Kept in the browser.
 */
export interface AssistantProps {
  /**
   * What it shows while performing (the note names), and the menu for the key they are read in (`done` closes it).
   * Without it, no performing (the desktop pet has no song).
   */
  performance?: { names: ReactNode; keys: (done: () => void) => ReactNode }
  /** How the perform button looks: by default "perform" (the desktop pet's practise button turns into it). */
  performButton?: { label: string; icon: ReactNode }
  /** More buttons over its head, after settings and chat and before performing (the desktop pet's "practise"). */
  buttons?: Array<{ label: string; icon: ReactNode; onClick: () => void }>
  /** A press on the pet (the desktop pet drags its window from there); without it, dragging moves it on the page. */
  onPetPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
  /** Whether the press that just ended moved the pet: then it was no click. */
  petWasDragged?: () => boolean
  onPetDoubleClick?: () => void
  /** Where the tools run; by default with this page's player (the desktop pet: in the practice window, when open). */
  host?: ToolHost
}

export function Assistant({ performance, performButton, buttons = [], onPetPointerDown, petWasDragged, onPetDoubleClick, host }: AssistantProps) {
  const { t } = useLanguage()
  const { player } = usePlayer()
  const assistant = useAssistant()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const corner = useRef<HTMLDivElement>(null)
  const place = usePetPlace(corner)
  const [settings, setSettings] = useState(false)
  const [storedPerformingOn, setPerforming] = useState(storedPerforming)
  const performing = performance !== undefined && storedPerformingOn
  const [keys, setKeys] = useState(false)
  // The bubble once closed stays closed until the next question.
  const [dismissed, setDismissed] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadStatus()
  }, [])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  // Follow the answer as it grows.
  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [assistant.reply, assistant.actions.length, assistant.error])

  const ready = assistant.status?.ready ?? false
  const hasAnswer = Boolean(assistant.question || assistant.error)
  const showBubble = !performing && !settings && !dismissed && (open || assistant.busy || hasAnswer)

  const perform = (on: boolean) => {
    setPerforming(on)
    storePerforming(on)
    // No chatting while performing; the key is picked as it starts.
    if (on) setOpen(false)
    setKeys(on)
  }

  const send = (event?: FormEvent) => {
    event?.preventDefault()
    if (!draft.trim() || assistant.busy || !ready) return
    setDismissed(false)
    void ask(draft, host ?? playerHost(player))
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event)
    if (event.key === 'Escape') setOpen(false)
  }

  let content
  if (!assistant.status) content = <p className={styles.muted}>…</p>
  else if (!ready)
    content = <p>{t('吉他弦断了：{problem}', { problem: assistant.status.problem ?? assistant.error ?? '' })}</p>
  else if (!hasAnswer) content = <p>{t('嘀嘀嘀哒啦啦~你好，我是你的吉他小助手，今天你想要做什么？')}</p>
  else
    content = (
      <>
        {assistant.question && <p className={styles.question}>{assistant.question}</p>}
        {assistant.reply && <p className={styles.reply}>{assistant.reply}</p>}
        {assistant.actions.length > 0 && (
          <ul className={`${styles.actions} ${assistant.undone ? styles.undone : ''}`}>
            {assistant.actions.map((action, index) => (
              <li key={index} className={action.ok ? undefined : styles.failed}>
                {action.ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                {action.label}
              </li>
            ))}
          </ul>
        )}
        {assistant.undoable && !assistant.busy && (
          <button type="button" className={styles.undo} onClick={() => void undoAnswer()}>
            <Undo2 size={13} aria-hidden="true" />
            {t('撤销这些改动')}
          </button>
        )}
        {assistant.undone && <p className={styles.muted}>{t('已撤销这些改动。')}</p>}
        {assistant.busy && !assistant.reply && <p className={styles.muted}>{t('你我怎么两清~')}</p>}
        {assistant.error && <p className={styles.error}>{t('弹错音了：{message}', { message: assistant.error })}</p>}
      </>
    )

  return (
    <div ref={corner} className={styles.corner} style={onPetPointerDown ? undefined : place.style}>
      {settings && <PetSettings onClose={() => setSettings(false)} />}
      {performing && !settings && <div className={styles.performance}>{performance?.names}</div>}
      {showBubble && (
        <div className={styles.bubble}>
          <div ref={scroller} className={styles.scroll} role="status" aria-live="polite">
            {content}
          </div>
          <button type="button" className={styles.close} aria-label={t('关闭对话框')} title={t('关闭对话框')} onClick={() => setDismissed(true)}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className={styles.stage}>
        {menu && (
          <div className={styles.menu} role="toolbar" aria-label={t('助手')}>
            <button type="button" className={styles.menuButton} aria-label={t('设置')} title={t('设置')} aria-pressed={settings} onClick={() => setSettings(!settings)}>
              <Settings size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.menuButton}
              aria-label={t('输入框')}
              title={t('输入框')}
              aria-pressed={open}
              disabled={performing}
              onClick={() => {
                setOpen(!open)
                if (open) return
                setDismissed(false)
                // The server reads .env again each time: a model set up meanwhile is found.
                if (!assistant.busy) void loadStatus(true)
              }}
            >
              <MessageSquare size={15} aria-hidden="true" />
            </button>
            {buttons.map((button) => (
              <button key={button.label} type="button" className={styles.menuButton} aria-label={button.label} title={button.label} onClick={button.onClick}>
                {button.icon}
              </button>
            ))}
            {performance !== undefined && (
              <Popover
                open={keys && performing}
                onClose={() => setKeys(false)}
                placement="above"
                align="start"
                label={t('唱名的调')}
                trigger={
                  <button
                    type="button"
                    className={styles.menuButton}
                    aria-label={performButton?.label ?? t('演奏')}
                    title={performButton?.label ?? t('演奏')}
                    aria-pressed={performing}
                    onClick={() => perform(!performing)}
                  >
                    {performButton?.icon ?? <Music size={15} aria-hidden="true" />}
                  </button>
                }
              >
                {performance.keys(() => setKeys(false))}
              </Popover>
            )}
          </div>
        )}
        <button
          type="button"
          className={styles.pet}
          aria-label={t('助手')}
          aria-expanded={menu}
          title={t('助手')}
          onPointerDown={onPetPointerDown ?? place.onPointerDown}
          onClick={() => !(petWasDragged ?? place.wasDragged)() && setMenu(!menu)}
          onDoubleClick={onPetDoubleClick}
        >
          <Pet mood={assistant.mood} />
        </button>
      </div>
      {open && (
        <form className={styles.composer} onSubmit={send}>
          <textarea
            ref={input}
            rows={1}
            value={draft}
            disabled={!ready}
            placeholder={t('你不要那样看着我的眼睛~')}
            aria-label={t('你不要那样看着我的眼睛~')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {assistant.busy ? (
            <button type="button" className={styles.icon} aria-label={t('停止')} title={t('停止')} onClick={stop}>
              <Square size={16} />
            </button>
          ) : (
            <button type="submit" className={styles.icon} aria-label={t('发送')} title={t('发送')} disabled={!ready || !draft.trim()}>
              <Send size={16} />
            </button>
          )}
          <button
            type="button"
            className={styles.icon}
            aria-label={t('新对话')}
            title={t('新对话')}
            disabled={!hasAnswer && !assistant.busy}
            onClick={newConversation}
          >
            <RotateCcw size={16} />
          </button>
          <button type="button" className={styles.icon} aria-label={t('收起')} title={t('收起')} onClick={() => setOpen(false)}>
            <ChevronDown size={16} />
          </button>
        </form>
      )}
    </div>
  )
}
