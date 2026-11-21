import { useEffect, useRef } from 'react'
import { ChatSurfaceSwitch, SessionTerminal, chatSurfaceOf, type TerminalLine } from '../components/ChatSurfaceSwitch'
import { Composer } from '../components/Composer'
import { ReviewQueueButton } from '../components/ReviewQueue'
import { ViewTitle } from '../components/SurfaceLogo'
import { formatTime } from '../lib'
import { useWorkspace } from '../store'
import type { Approval, WorkflowEvent } from '../types'
import { TASK_STATUS_LABEL } from '../types'
import { ApprovalChoices, hasApprovalChoices } from '../components/ApprovalChoices'
import { TaskProcess } from '../components/TaskProcess'
import { Avatar, Badge, Button } from '../ui'

export function TaskSession({ taskId }: { taskId: string }) {
  const { state, task, agent, project } = useWorkspace()
  const item = task(taskId)
  const owner = agent(item?.ownerAgentId ?? '')
  const surfaceId = `task:${taskId}`
  const surface = chatSurfaceOf(state.prefs.chatSurfaces, surfaceId)
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [state.events, state.messages, taskId, surface])
  if (!item) return <div className="aha-empty">找不到这个任务。</div>
  const events = state.events.filter((event) => event.taskId === taskId)
  const chats = state.messages.filter((message) => message.channelType === 'task' && message.channelId === taskId)
  const pending = state.approvals.filter((row) => row.taskId === taskId && row.status === 'pending')
  const showAcceptance = item.status === 'review' && pending.length === 0
  const proj = project(item.projectId)
  const termLines: TerminalLine[] = [
    ...events.map((event) => ({
      id: event.id,
      who: agent(event.actorId)?.name ?? '系统',
      text: event.text,
      time: formatTime(event.occurredAt),
      tone: 'system' as const,
    })),
    ...chats.map((message) => ({
      id: message.id,
      who: agent(message.authorId)?.name ?? (message.role === 'you' ? '你' : '智能体'),
      text: message.text,
      time: formatTime(message.createdAt),
      tone: (message.role === 'you' ? 'you' : 'agent') as 'you' | 'agent',
    })),
  ]

  return (
    <section className="aha-page aha-session">
      <header className="aha-session-head">
        <ViewTitle kind="agent" letter={owner?.name} kicker={proj?.name} title={item.name}>
          <p>
            <Badge tone={item.status === 'review' ? 'warning' : item.status === 'done' ? 'success' : 'soft'}>
              {TASK_STATUS_LABEL[item.status]}
            </Badge>
            <span className="aha-muted"> · {owner?.name}</span>
          </p>
        </ViewTitle>
        <div className="aha-session-tools">
          <ReviewQueueButton currentTaskId={taskId} />
          <ChatSurfaceSwitch surfaceId={surfaceId} />
        </div>
      </header>
      <div className="aha-session-process">
        <TaskProcess task={item} events={events} variant="compact" showTitle={false} />
      </div>
      {surface === 'terminal' ? (
        <SessionTerminal
          lines={
            termLines.length
              ? termLines
              : [{ id: 'wait', who: 'host', text: '任务已排队，等待 Aha Host 指派。', tone: 'system' }]
          }
        >
          {pending.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
          {showAcceptance ? <AcceptanceCard taskId={item.id} name={item.name} /> : null}
        </SessionTerminal>
      ) : (
        <div className="aha-session-log" ref={log}>
          {events.length === 0 ? <p className="aha-muted">任务已排队，等待 Aha Host 指派。</p> : null}
          {events.map((event) => (
            <EventBlock key={event.id} event={event} />
          ))}
          {chats.map((message) => {
            const person = agent(message.authorId)
            return (
              <article key={message.id} className={`aha-msg${message.role === 'you' ? ' aha-msg--you' : ''}`}>
                {person ? <Avatar agent={person} size="sm" /> : null}
                <div>
                  <p className="aha-msg-who">
                    {person?.name}
                    <time className="aha-msg-time">{formatTime(message.createdAt)}</time>
                  </p>
                  <p className="aha-msg-body">{message.text}</p>
                </div>
              </article>
            )
          })}
          {pending.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
          {showAcceptance ? <AcceptanceCard taskId={item.id} name={item.name} /> : null}
        </div>
      )}
      <Composer
        channelType="task"
        channelId={item.id}
        projectId={item.projectId}
        placeholder={`发送给${agent(item.ownerAgentId)?.name ?? '负责人'}…`}
      />
    </section>
  )
}

function EventBlock({ event }: { event: WorkflowEvent }) {
  const { agent } = useWorkspace()
  const actor = agent(event.actorId)
  const label =
    event.type === 'assign'
      ? '指派'
      : event.type === 'step'
        ? '步骤'
        : event.type === 'report'
          ? '回报'
          : event.type === 'approval'
            ? '审批'
            : event.type === 'acceptance'
              ? '验收'
              : '对话'
  return (
    <article className="aha-flow">
      {actor ? <Avatar agent={actor} size="sm" /> : null}
      <div>
        <p className="aha-msg-who">
          <Badge tone="neutral">{label}</Badge>
          <span>{actor?.name ?? '系统'}</span>
          <time className="aha-msg-time">{formatTime(event.occurredAt)}</time>
        </p>
        <p className="aha-msg-body">{event.text}</p>
      </div>
    </article>
  )
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const { dispatch } = useWorkspace()
  return (
    <article className="aha-decision">
      <div className="aha-decision-top">
        <Badge tone="warning">待审批</Badge>
        <span>{approval.kind}</span>
      </div>
      <h3>{approval.title}</h3>
      <p>{approval.detail}</p>
      {hasApprovalChoices(approval) ? <ApprovalChoices approval={approval} /> : (
        <div className="aha-decision-actions">
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'rejected' })}>
            拒绝
          </Button>
          <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'approved' })}>
            允许
          </Button>
          <Button size="sm" variant="ghost" className="aha-linkish" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId: approval.id } })}>
            查看
          </Button>
        </div>
      )}
      {hasApprovalChoices(approval) ? (
        <div className="aha-decision-actions">
          <Button size="sm" variant="ghost" className="aha-linkish" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId: approval.id } })}>
            查看
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function AcceptanceCard({ taskId, name }: { taskId: string; name: string }) {
  const { dispatch } = useWorkspace()
  return (
    <article className="aha-decision">
      <div className="aha-decision-top">
        <Badge tone="success">待验收</Badge>
      </div>
      <h3>验收「{name}」</h3>
      <p>交付已准备好。查看说明后，允许将完成任务，拒绝会回到进行中。</p>
      <div className="aha-decision-actions">
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'accept-delivery', taskId, allow: false })}>
          拒绝
        </Button>
        <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'accept-delivery', taskId, allow: true })}>
          允许
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="aha-linkish"
          onClick={() => dispatch({ type: 'toast', message: '交付说明：目标文件与验收要求已在右栏列出，可供核对。' })}
        >
          查看
        </Button>
      </div>
    </article>
  )
}

