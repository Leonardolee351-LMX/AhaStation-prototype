import { useEffect, useId, useRef, type ReactNode } from 'react'
import { taskProcessRatio } from '../components/TaskProcess'
import { IconChevronRight, IconClose, IconMic, IconSend } from '../icons'
import { formatTime, formatWait } from '../lib'
import { useWorkspace } from '../store'
import type { Approval, ChatMessage, Task, WorkflowEvent } from '../types'

export function taskProgress(task: Task, events: WorkflowEvent[] = []) {
  return Math.round(taskProcessRatio(task.status, events.filter((event) => event.taskId === task.id)) * 100)
}

export function PortraitDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const trigger = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.closest('[hidden]')) {
        trigger.focus({ preventScroll: true })
      }
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="hhp-theme hhp-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="hhp-dialog-inner">
        <header className="hhp-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="hhp-icon-button" aria-label="关闭" onClick={onClose}><IconClose size={18} /></button>
        </header>
        {children}
      </div>
    </dialog>
  )
}

export function PortraitMessage({ message }: { message: ChatMessage }) {
  const { agent } = useWorkspace()
  const outgoing = message.role === 'you'
  const name = outgoing ? '你' : message.role === 'host' ? 'Aha 助理' : agent(message.authorId)?.name ?? '系统'
  return (
    <article className={`hhp-message${outgoing ? ' is-outgoing' : ''}`}>
      <div className="hhp-message-meta">
        <strong>{name}</strong>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      </div>
      <p className="hhp-message-bubble">{message.text}</p>
    </article>
  )
}

export function PortraitComposer({ value, onChange, onSend, onVoice, label, sendDisabled = false }: {
  value: string
  onChange: (value: string) => void
  onSend: (value: string) => void
  onVoice?: () => void
  label: string
  sendDisabled?: boolean
}) {
  const submit = () => {
    if (!sendDisabled && value.trim()) onSend(value.trim())
  }
  return (
    <form className="hhp-composer" onSubmit={(event) => { event.preventDefault(); submit() }}>
      <textarea
        aria-label={label}
        placeholder={label}
        rows={2}
        maxLength={600}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
          event.preventDefault()
          submit()
        }}
      />
      {onVoice && <button type="button" className="hhp-icon-button" aria-label="语音输入" onClick={onVoice}><IconMic size={18} /></button>}
      <button type="submit" className="hhp-icon-button is-primary" aria-label="发送" disabled={sendDisabled || !value.trim()}><IconSend size={18} /></button>
    </form>
  )
}

export function PortraitApproval({ approval, onTask, onShowApproval }: {
  approval: Approval
  onTask?: (id: string) => void
  onShowApproval: (id: string) => void
}) {
  const { agent, task, project, dispatch } = useWorkspace()
  const item = task(approval.taskId)
  const owner = item ? agent(item.ownerAgentId)?.name : undefined
  const projectName = item ? project(item.projectId)?.name : undefined
  const pending = approval.status === 'pending'
  const approved = approval.status === 'approved'
  const chosen = approval.options?.find((option) => option.id === approval.decision)
  const result = approved ? (chosen ? `已确认 · ${chosen.label}` : '已允许') : '已拒绝'
  return (
    <article className={`hhp-card hhp-approval${approval.blocked && pending ? ' is-blocking' : ''}`}>
      <div className="hhp-approval-meta">
        <span>{[projectName, approval.kind].filter(Boolean).join(' · ')}</span>
        <span className={`hhp-tag ${pending ? 'is-warning' : approved ? 'is-success' : 'is-neutral'}`}>
          {pending ? `${approval.blocked ? '阻塞' : '待审批'} · ${formatWait(approval.requestedAt)}` : result}
        </span>
      </div>
      <h3>{approval.title}</h3>
      <p>{approval.detail}</p>
      {(item || owner) && <p className="hhp-approval-context">{[item?.name, owner].filter(Boolean).join(' · ')}</p>}
      <div className="hhp-approval-actions">
        {pending && <>
          <button type="button" className="hhp-button is-quiet" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'rejected' })}>拒绝</button>
          <button type="button" className="hhp-button is-primary" onClick={() => {
            if (approval.options?.length) onShowApproval(approval.id)
            else dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'approved' })
          }}>允许</button>
        </>}
        {onTask && item && <button type="button" className="hhp-button is-quiet hhp-approval-task" onClick={() => onTask(item.id)}>
          查看任务 <IconChevronRight size={16} />
        </button>}
      </div>
    </article>
  )
}
