import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { IconClose } from './icons'
import { agentTone } from './lib'
import type { Agent, AvatarTone } from './types'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'aha-btn',
    `aha-btn--${variant}`,
    `aha-btn--${size}`,
    icon ? 'aha-btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}

type BadgeTone = 'soft' | 'warning' | 'success' | 'neutral'

export function Badge({
  tone = 'soft',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return <span className={`aha-badge aha-badge--${tone}`}>{children}</span>
}

export function Avatar({
  agent,
  size = 'md',
  tone,
}: {
  agent: Pick<Agent, 'name' | 'role' | 'id'>
  size?: 'sm' | 'md' | 'lg'
  tone?: AvatarTone
}) {
  const letter = agent.name.slice(0, 1)
  const resolved = tone ?? agentTone(agent as Agent)
  return (
    <span className={`aha-avatar aha-avatar--${size} aha-avatar--${resolved}`} aria-hidden="true">
      {letter}
    </span>
  )
}

export function AvatarStack({ agents }: { agents: Pick<Agent, 'id' | 'name' | 'role'>[] }) {
  const shown = agents.slice(0, 4)
  const extra = agents.length - shown.length
  return (
    <ul className="aha-avatars">
      {shown.map((agent) => (
        <li key={agent.id}>
          <Avatar agent={agent} size="sm" />
          <span className="aha-visually-hidden">{agent.name}</span>
        </li>
      ))}
      {extra > 0 ? <li className="aha-avatars-more">+{extra}</li> : null}
    </ul>
  )
}

export function Meter({
  label,
  value,
  tone = 'primary',
}: {
  label: string
  value: number
  tone?: 'primary' | 'success'
}) {
  const pct = Math.max(0, Math.min(1, value))
  const style = { '--aha-meter-fill': String(pct) } as CSSProperties
  return (
    <div className="aha-meter">
      <div className="aha-meter-row">
        <span>{label}</span>
        <span>{Number.isFinite(value) ? `${Math.round(pct * 100)}%` : '—'}</span>
      </div>
      <div className="aha-meter-track" role="meter" aria-label={label} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span className={`aha-meter-fill aha-meter-fill--${tone}`} style={style} />
      </div>
    </div>
  )
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  width = 'md',
  showClose = true,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: 'md' | 'lg' | 'sm'
  showClose?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab' || !panel) return
      const nodes = [
        ...panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.hasAttribute('disabled'))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lastFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="aha-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className={`aha-dialog aha-dialog--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aha-dialog-head">
          <h2 id={titleId} className="aha-dialog-title">
            {title}
          </h2>
          {showClose ? (
            <Button variant="ghost" size="sm" icon className="aha-dialog-close" onClick={onClose} aria-label="关闭">
              <IconClose size={16} />
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="aha-toast-region" role="status" aria-live="polite">
      <div className="aha-toast">{message}</div>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className={`aha-field${error ? ' is-invalid' : ''}`}>
      <span className="aha-field-label">{label}</span>
      {children}
      {error ? <span className="aha-field-error">{error}</span> : hint ? <span className="aha-field-hint">{hint}</span> : null}
    </label>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} className="aha-input" {...props} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} className="aha-textarea" {...props} />
})

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`aha-switch${checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="aha-switch-knob" />
      <span className="aha-switch-label">{label}</span>
    </button>
  )
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="aha-empty">
      <p className="aha-empty-title">{title}</p>
      {text ? <p className="aha-empty-text">{text}</p> : null}
    </div>
  )
}
