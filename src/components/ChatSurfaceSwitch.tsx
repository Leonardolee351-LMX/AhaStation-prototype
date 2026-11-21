import { useEffect, useRef, type ReactNode } from 'react'
import { useWorkspace } from '../store'
import type { ChatSurface } from '../types'

export function chatSurfaceOf(surfaces: Record<string, ChatSurface> | undefined, id: string): ChatSurface {
  return surfaces?.[id] ?? 'dialog'
}

export function ChatSurfaceSwitch({ surfaceId }: { surfaceId: string }) {
  const { state, dispatch } = useWorkspace()
  const value = chatSurfaceOf(state.prefs.chatSurfaces, surfaceId)
  const setValue = (next: ChatSurface) => {
    dispatch({
      type: 'set-prefs',
      patch: { chatSurfaces: { ...state.prefs.chatSurfaces, [surfaceId]: next } },
    })
  }
  return (
    <div className="aha-seg" role="group" aria-label="对话界面">
      <button
        type="button"
        className={`aha-seg-btn${value === 'dialog' ? ' is-selected' : ''}`}
        aria-pressed={value === 'dialog'}
        onClick={() => setValue('dialog')}
      >
        对话框
      </button>
      <button
        type="button"
        className={`aha-seg-btn${value === 'terminal' ? ' is-selected' : ''}`}
        aria-pressed={value === 'terminal'}
        onClick={() => setValue('terminal')}
      >
        终端
      </button>
    </div>
  )
}

export type TerminalLine = {
  id: string
  who: string
  text: string
  time?: string
  tone?: 'you' | 'agent' | 'system'
}

export function SessionTerminal({ lines, children }: { lines: TerminalLine[]; children?: ReactNode }) {
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [lines.length])
  return (
    <div className="aha-terminal aha-terminal--session" ref={log} aria-label="终端对话">
      {lines.length === 0 ? <p className="aha-terminal-muted"># 还没有输出</p> : null}
      {lines.map((line) => (
        <p key={line.id} className={`aha-term-line aha-term-line--${line.tone ?? 'agent'}`}>
          <span className="aha-term-who">{line.tone === 'you' ? '>' : line.tone === 'system' ? '#' : '$'}</span>
          <span>
            <span className="aha-term-name">{line.who}</span>
            {line.time ? <time> {line.time}</time> : null}
            {'  '}
            {line.text}
          </span>
        </p>
      ))}
      {children}
    </div>
  )
}
