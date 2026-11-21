import { useEffect, useRef, useState } from 'react'
import { IconChevronDown } from '../icons'
import { nextReviewItem, reviewQueue } from '../lib'
import { useWorkspace } from '../store'
import { Avatar, Badge } from '../ui'

export function ReviewQueueButton({ currentTaskId }: { currentTaskId?: string }) {
  const { state, agent, openTask } = useWorkspace()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const items = reviewQueue(state.approvals, state.tasks, state.projects, state.agents)
  const next = nextReviewItem(items, currentTaskId)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const jump = (taskId: string) => {
    setOpen(false)
    if (taskId !== currentTaskId) openTask(taskId)
  }

  return (
    <div className="aha-review-wrap" ref={root}>
      <button
        type="button"
        className={`aha-review-chip${items.length ? ' is-hot' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={items.length ? `待核对，共 ${items.length} 项` : '暂无待核对'}
        disabled={items.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        <span>待核对</span>
        <span className="aha-review-count">{items.length}</span>
        <IconChevronDown size={16} />
      </button>
      {open ? (
        <div className="aha-review-pop" role="dialog" aria-label="待核对事项">
          <div className="aha-review-pop-head">
            <p>
              待核对 <span className="aha-muted">({items.length})</span>
            </p>
            {next ? (
              <button type="button" className="aha-review-next" onClick={() => jump(next.taskId)}>
                下一项
              </button>
            ) : null}
          </div>
          <ul className="aha-review-list">
            {items.map((item) => {
              const owner = agent(state.tasks.find((task) => task.id === item.taskId)?.ownerAgentId ?? '')
              const current = item.taskId === currentTaskId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`aha-review-item${current ? ' is-current' : ''}`}
                    onClick={() => jump(item.taskId)}
                  >
                    {owner ? <Avatar agent={owner} size="sm" /> : null}
                    <span className="aha-review-item-copy">
                      <span className="aha-review-item-title">{item.title}</span>
                      <span className="aha-muted">
                        {item.agentName}
                        {item.projectName ? ` · ${item.projectName}` : ''}
                      </span>
                    </span>
                    <Badge tone={item.badge === '待验收' ? 'success' : 'warning'}>{item.badge}</Badge>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
