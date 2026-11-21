import { IconCheck } from '../icons'
import { formatTime } from '../lib'
import type { EventType, Task, WorkflowEvent } from '../types'
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER, type TaskStatus } from '../types'
import { Badge } from '../ui'

const EVENT_LABEL: Record<EventType, string> = {
  assign: '指派',
  step: '步骤',
  report: '回报',
  approval: '审批',
  acceptance: '验收',
  chat: '对话',
}

export function taskProcessRatio(status: TaskStatus, events: WorkflowEvent[]): number {
  if (status === 'todo') return 0
  if (status === 'review') return 0.85
  if (status === 'done') return 1
  const steps = events.filter((item) => item.type === 'step' || item.type === 'report').length
  return Math.min(0.72, 0.28 + steps * 0.16)
}

function badgeTone(status: TaskStatus): 'warning' | 'success' | 'soft' | 'neutral' {
  if (status === 'review') return 'success'
  if (status === 'done') return 'success'
  if (status === 'doing') return 'soft'
  return 'neutral'
}

export function TaskProcess({
  task,
  events,
  variant = 'compact',
  showTitle = true,
}: {
  task: Task
  events: WorkflowEvent[]
  variant?: 'compact' | 'full' | 'tile'
  showTitle?: boolean
}) {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const ratio = taskProcessRatio(task.status, sorted)
  const percent = Math.round(ratio * 100)
  const latest = task.latestUpdate || sorted[sorted.length - 1]?.text
  const currentIndex = TASK_STATUS_ORDER.indexOf(task.status)

  return (
    <div className={`aha-task-process is-${variant}`}>
      {variant !== 'tile' ? (
        <div className="aha-task-process-head">
          {showTitle ? <p className="aha-task-process-title">{task.name}</p> : null}
          <Badge tone={badgeTone(task.status)}>{TASK_STATUS_LABEL[task.status]}</Badge>
        </div>
      ) : null}
      {variant === 'tile' ? null : (
        <div className="aha-progress-label">
          <span>{latest || '等待开始'}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div
        className={`aha-progress${task.status === 'review' || task.status === 'done' ? ' aha-progress--success' : ''}`}
        role="progressbar"
        aria-label={`${task.name}进度 ${percent}%`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ transform: `scaleX(${ratio})` }} />
      </div>
      {variant === 'full' ? (
        <>
          <ol className="aha-process-stages" aria-label="任务阶段">
            {TASK_STATUS_ORDER.map((status, index) => (
              <li key={status} className={index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : undefined}>
                {TASK_STATUS_LABEL[status]}
              </li>
            ))}
          </ol>
          {sorted.length ? (
            <ol className="aha-timeline">
              {sorted.map((event, index) => {
                const complete = task.status === 'done' || index < sorted.length - 1
                return (
                  <li key={event.id} className={`aha-timeline-item${complete ? '' : ' is-current'}`}>
                    <span className="aha-timeline-mark">{complete ? <IconCheck size={14} /> : <span className="aha-timeline-dot" />}</span>
                    <div>
                      <h3 className="aha-card-title">{EVENT_LABEL[event.type]}</h3>
                      <p>{event.text}</p>
                      <p className="aha-timeline-time">{formatTime(event.occurredAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="aha-muted">任务已排队，等待 Aha Host 指派。</p>
          )}
        </>
      ) : null}
    </div>
  )
}

export function eventsForTask(events: WorkflowEvent[], taskId: string) {
  return events.filter((item) => item.taskId === taskId)
}
