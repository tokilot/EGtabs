import { useEffect, useRef, useState } from 'react'
import { request } from '../shared/http.ts'
import { useLanguage } from '../shared/ui/i18n.ts'
import styles from './Assistant.module.css'

/**
 * The pet's settings (2026-11-12): data/assistant.md as it is, to edit and save. It is read again on the server for
 * every question, so a saved change counts from the next one.
 */
export function PetSettings({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()
  const [saved, setSaved] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    request<{ text: string }>('/api/assistant/persona')
      .then(({ text: loaded }) => {
        if (cancelled) return
        setSaved(loaded)
        setText(loaded)
        area.current?.focus()
      })
      .catch((cause) => !cancelled && setError((cause as Error).message))
    return () => {
      cancelled = true
    }
  }, [])

  const dirty = saved !== null && text !== saved

  const close = () => {
    if (dirty && !window.confirm(t('存在未保存的修改，是否关闭？'))) return
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await request<{ text: string }>('/api/assistant/persona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      setSaved(result.text)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className={styles.settings}
      role="dialog"
      aria-label={t('宠物设置')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    >
      <h2>{t('宠物设置')}</h2>
      <textarea
        ref={area}
        value={text}
        disabled={saved === null}
        spellCheck={false}
        aria-label={t('宠物设置')}
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      {error && <p className={styles.error}>{t('出错了：{message}', { message: error })}</p>}
      <div className={styles.settingsButtons}>
        <button type="button" onClick={close}>
          {t('关闭')}
        </button>
        <button type="button" className={styles.primary} disabled={!dirty || saving} onClick={() => void save()}>
          {t('保存')}
        </button>
      </div>
    </section>
  )
}
