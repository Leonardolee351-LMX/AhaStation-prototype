import { useEffect, useMemo, useRef, useState } from 'react'
import { VOICE_SAMPLE, YOU_ID } from '../data'
import { IconAt, IconHash, IconMic, IconPaperclip, IconSend, IconSlash } from '../icons'
import { isHandheldView, useWorkspace } from '../store'
import type { ChannelType } from '../types'
import { Button } from '../ui'

const LIMITS: Record<ChannelType, number> = {
  host: 1000,
  discussion: 1000,
  task: 600,
}

const SLASH_COMMANDS = [
  { id: 'progress', token: '/进展', hint: '请 Aha 汇总当前工作' },
  { id: 'discuss', token: '/讨论', hint: '发起一个项目讨论' },
  { id: 'help', token: '/帮助', hint: '查看可用的输入指令' },
] as const

type MenuKind = 'at' | 'slash' | 'hash' | 'file'

type MenuItem = {
  id: string
  label: string
  hint?: string
  insert: string
}

function triggerAt(text: string, caret: number): { kind: Exclude<MenuKind, 'file'>; query: string; start: number } | null {
  const before = text.slice(0, caret)
  const match = before.match(/([@/#])([^\s@/#]*)$/)
  if (!match) return null
  const mark = match[1]
  const kind = mark === '@' ? 'at' : mark === '/' ? 'slash' : 'hash'
  return { kind, query: match[2], start: caret - match[0].length }
}

export function Composer({
  channelType,
  channelId,
  projectId,
  placeholder,
}: {
  channelType: ChannelType
  channelId: string
  projectId?: string
  placeholder: string
}) {
  const { state, dispatch, sendText, startVoice } = useWorkspace()
  const limit = LIMITS[channelType]
  const rich = channelType === 'host'
  const voiceEmphasis = channelType === 'host' || channelType === 'task'
  const draft =
    channelType === 'host'
      ? state.drafts.host
      : channelType === 'task'
        ? (state.drafts.tasks[channelId] ?? '')
        : (state.drafts.discussions[channelId] ?? '')
  const voice =
    state.voice &&
    state.voice.target === 'composer' &&
    state.voice.origin.channelType === channelType &&
    state.voice.origin.channelId === channelId
      ? state.voice
      : null
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [menuKind, setMenuKind] = useState<MenuKind | null>(null)
  const [menuQuery, setMenuQuery] = useState('')
  const [menuStart, setMenuStart] = useState(0)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const node = areaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [draft])

  const menuItems = useMemo(() => {
    if (!menuKind) return [] as MenuItem[]
    const query = menuQuery.trim().toLowerCase()
    if (menuKind === 'at') {
      return state.agents
        .filter((agent) => agent.id !== YOU_ID)
        .filter((agent) => !query || agent.name.toLowerCase().includes(query) || agent.slug.toLowerCase().includes(query))
        .slice(0, 8)
        .map((agent) => ({ id: agent.id, label: `@${agent.slug}`, hint: agent.name, insert: `@${agent.name} ` }))
    }
    if (menuKind === 'slash') {
      return SLASH_COMMANDS.filter((item) => !query || item.token.slice(1).includes(query) || item.hint.includes(query)).map((item) => ({
        id: item.id,
        label: item.token,
        hint: item.hint,
        insert: `${item.token} `,
      }))
    }
    if (menuKind === 'hash') {
      const projects = state.projects
        .filter((item) => !query || item.name.toLowerCase().includes(query))
        .map((item) => ({ id: `p-${item.id}`, label: `#${item.name}`, hint: '项目', insert: `#${item.name} ` }))
      const tasks = state.tasks
        .filter((item) => !query || item.name.toLowerCase().includes(query))
        .slice(0, 8)
        .map((item) => ({ id: `t-${item.id}`, label: `#${item.name}`, hint: '任务', insert: `#${item.name} ` }))
      return [...projects, ...tasks].slice(0, 10)
    }
    const seen = new Set<string>()
    const files: MenuItem[] = []
    for (const file of state.files) {
      if (seen.has(file.path)) continue
      if (query && !file.path.toLowerCase().includes(query)) continue
      seen.add(file.path)
      files.push({ id: file.path, label: file.path.split('/').pop() ?? file.path, hint: file.path, insert: `文件:${file.path} ` })
      if (files.length >= 10) break
    }
    return files
  }, [menuKind, menuQuery, state.agents, state.projects, state.tasks, state.files])

  useEffect(() => {
    setActive(0)
  }, [menuKind, menuQuery])

  function setDraft(text: string) {
    dispatch({ type: 'set-draft', channelType, channelId, text: text.slice(0, limit) })
  }

  function closeMenu() {
    setMenuKind(null)
    setMenuQuery('')
  }

  function insertToken(item: MenuItem) {
    const node = areaRef.current
    const caret = node?.selectionStart ?? draft.length
    const start = menuKind && menuKind !== 'file' ? menuStart : caret
    const next = `${draft.slice(0, start)}${item.insert}${draft.slice(caret)}`.slice(0, limit)
    setDraft(next)
    closeMenu()
    window.requestAnimationFrame(() => {
      const pos = start + item.insert.length
      areaRef.current?.focus()
      areaRef.current?.setSelectionRange(pos, pos)
    })
  }

  function openMenu(kind: MenuKind) {
    const node = areaRef.current
    const caret = node?.selectionStart ?? draft.length
    const mark = kind === 'at' ? '@' : kind === 'slash' ? '/' : kind === 'hash' ? '#' : ''
    if (kind === 'file') {
      setMenuKind('file')
      setMenuQuery('')
      setMenuStart(caret)
      node?.focus()
      return
    }
    const next = `${draft.slice(0, caret)}${mark}${draft.slice(caret)}`.slice(0, limit)
    setDraft(next)
    setMenuKind(kind)
    setMenuQuery('')
    setMenuStart(caret)
    window.requestAnimationFrame(() => {
      const pos = caret + 1
      areaRef.current?.focus()
      areaRef.current?.setSelectionRange(pos, pos)
    })
  }

  function syncMenuFromCaret(text: string, caret: number) {
    if (!rich) {
      closeMenu()
      return
    }
    const found = triggerAt(text, caret)
    if (!found) {
      if (menuKind && menuKind !== 'file') closeMenu()
      return
    }
    setMenuKind(found.kind)
    setMenuQuery(found.query)
    setMenuStart(found.start)
  }

  function submit(text: string) {
    const value = text.trim()
    if (!value) return
    closeMenu()
    sendText(channelType, channelId, value.slice(0, limit), projectId)
  }

  if (voice) {
    return <VoiceBar />
  }

  const menuOpen = Boolean(menuKind) && (menuKind === 'file' || menuItems.length > 0)

  return (
    <form
      className={`aha-composer${rich || voiceEmphasis ? ' aha-composer--rich' : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (menuOpen && menuItems[active]) {
          insertToken(menuItems[active])
          return
        }
        submit(draft)
      }}
    >
      {menuOpen ? (
        <ul className="aha-composer-menu" role="listbox" aria-label="插入建议">
          {menuItems.length === 0 ? <li className="aha-muted">没有匹配的文件。</li> : null}
          {menuItems.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={index === active ? 'is-selected' : ''}
                onMouseEnter={() => setActive(index)}
                onClick={() => insertToken(item)}
              >
                <span>{item.label}</span>
                {item.hint ? <span className="aha-muted">{item.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={areaRef}
        rows={1}
        value={draft}
        maxLength={limit}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => {
          const text = event.target.value.slice(0, limit)
          setDraft(text)
          syncMenuFromCaret(text, event.target.selectionStart ?? text.length)
        }}
        onKeyDown={(event) => {
          if (menuOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            setActive((value) => {
              const count = Math.max(menuItems.length, 1)
              return (value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
            })
            return
          }
          if (menuOpen && event.key === 'Escape') {
            event.preventDefault()
            closeMenu()
            return
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (menuOpen && menuItems[active]) insertToken(menuItems[active])
            else submit(draft)
          }
        }}
        onClick={(event) => syncMenuFromCaret(draft, event.currentTarget.selectionStart ?? draft.length)}
      />
      <div className="aha-composer-toolbar">
        {rich ? (
          <div className="aha-composer-tools" role="group" aria-label="插入">
            <Button type="button" variant="ghost" size="sm" icon aria-label="点名智能体" onClick={() => openMenu('at')}>
              <IconAt size={16} />
            </Button>
            <Button type="button" variant="ghost" size="sm" icon aria-label="指令" onClick={() => openMenu('slash')}>
              <IconSlash size={16} />
            </Button>
            <Button type="button" variant="ghost" size="sm" icon aria-label="引用项目或任务" onClick={() => openMenu('hash')}>
              <IconHash size={16} />
            </Button>
            <Button type="button" variant="ghost" size="sm" icon aria-label="附加文件" onClick={() => openMenu('file')}>
              <IconPaperclip size={16} />
            </Button>
          </div>
        ) : (
          <span />
        )}
        <div className="aha-composer-actions">
          <Button
            type="button"
            variant="primary"
            size={voiceEmphasis ? 'md' : 'sm'}
            className="aha-composer-voice"
            aria-label="语音对话"
            onClick={() => startVoice({ channelType, channelId, projectId }, 'composer')}
          >
            <IconMic size={voiceEmphasis ? 18 : 16} />
            {voiceEmphasis ? '语音对话' : null}
          </Button>
          <Button type="submit" variant="secondary" size="sm" icon aria-label="发送" disabled={!draft.trim()}>
            <IconSend size={16} />
          </Button>
        </div>
      </div>
    </form>
  )
}

export function VoiceBar() {
  const { state, dispatch, sendText } = useWorkspace()
  const voice = state.voice

  useEffect(() => {
    if (isHandheldView()) return
    if (!voice || voice.phase !== 'listening') return
    let index = 0
    const origin = voice.origin
    const target = voice.target
    const timer = window.setInterval(() => {
      index += 1
      const next = VOICE_SAMPLE.slice(0, index)
      dispatch({
        type: 'set-voice',
        voice: { phase: 'listening', origin, target, transcript: next },
      })
      if (index >= VOICE_SAMPLE.length) window.clearInterval(timer)
    }, 42)
    return () => window.clearInterval(timer)
  }, [voice?.phase, voice?.origin.channelId, dispatch])

  if (!voice) return null
  const canSend = voice.transcript.trim().length > 0

  return (
    <div className="aha-voice aha-voice--promoted" aria-live="polite">
      <div className="aha-voice-head">
        <IconMic size={20} />
        <p className="aha-voice-kicker">{voice.phase === 'sending' ? '正在发送' : '正在听你说'}</p>
      </div>
      <Waveform />
      <p className="aha-voice-text">{voice.transcript || '请开始说话…'}</p>
      <div className="aha-voice-actions">
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'set-voice', voice: null })}>
          取消
        </Button>
        <Button
          size="md"
          variant="primary"
          disabled={!canSend}
          onClick={() => sendText(voice.origin.channelType, voice.origin.channelId, voice.transcript, voice.origin.projectId)}
        >
          发送
        </Button>
      </div>
    </div>
  )
}

export function Waveform() {
  return (
    <div className="aha-wave" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => (
        <span key={index} style={{ animationDelay: `${index * 0.07}s` }} />
      ))}
    </div>
  )
}
