import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconCode, IconLink } from '../icons'
import { formatTime } from '../lib'
import { useWorkspace } from '../store'
import { TASK_STATUS_LABEL, type Approval, type ChatMessage, type DiffFile, type PullRequest, type Task, type WorkflowEvent } from '../types'
import {
  PortraitApproval,
  PortraitComposer,
  PortraitDialog,
  PortraitMessage,
  taskProgress,
} from './PortraitUI'
import './handheld-task.css'

type TaskProps = {
  taskId: string
  onShowApproval: (id: string) => void
  onVoice: () => void
  draft: string
  onDraftChange: (value: string) => void
}

type TaskEntry =
  | { type: 'message'; id: string; time: string; message: ChatMessage }
  | { type: 'approval'; id: string; time: string; approval: Approval }
  | { type: 'delivery'; id: string; time: string; event: WorkflowEvent }

type TaskLayer = { type: 'related' } | { type: 'diff'; pr: PullRequest }

function taskPullRequests(task: Task, pullRequests: PullRequest[]) {
  return pullRequests.filter((pr) => pr.taskId === task.id || (
    pr.projectId === task.projectId && pr.repositoryId === task.repositoryId && task.pullRequests?.includes(pr.number)
  ))
}

function PullRequestLinks({ pullRequests, onOpen }: { pullRequests: PullRequest[]; onOpen: (pr: PullRequest) => void }) {
  return (
    <div className="hhp-task-pr-links">
      {pullRequests.map((pr) => (
        <button className="hhp-button is-quiet" type="button" key={`${pr.repositoryId}#${pr.number}`} onClick={() => onOpen(pr)}>
          <IconCode size={16} /> 查看 PR #{pr.number}
        </button>
      ))}
    </div>
  )
}

function TaskDiffCode({ file, side }: { file: DiffFile; side: 'before' | 'after' }) {
  const before = side === 'before'
  const lines = file.hunks.filter((line) => line.changeType !== (before ? 'add' : 'delete'))
  const emptyText = before && file.changeType === 'add' ? '文件尚未创建'
    : !before && file.changeType === 'delete' ? '文件已删除' : '没有可显示的内容'

  return (
    <section className="hhp-task-diff-version">
      <h3>{before ? '修改前' : '修改后'}</h3>
      {lines.length ? (
        <pre aria-label={before ? '修改前的内容' : '修改后的内容'}><code>{lines.map((line, index) => (
          <span className={`hhp-task-diff-line is-${line.changeType}`} key={index}>
            <span className="hhp-task-diff-number" aria-hidden="true">{before ? line.oldLine : line.newLine}</span>
            <span>{line.text || '\u00a0'}</span>
          </span>
        ))}</code></pre>
      ) : <p className="hhp-muted">{emptyText}</p>}
    </section>
  )
}

function TaskDiff({ pr }: { pr: PullRequest }) {
  const [fileIndex, setFileIndex] = useState(0)
  const file = pr.files[fileIndex]

  return (
    <div className="hhp-task-diff">
      <p className="hhp-task-diff-path">{pr.headRef} → {pr.baseRef} · 只读</p>
      {pr.files.length > 1 ? (
        <label className="hhp-task-diff-file">
          <span>变更文件</span>
          <select value={fileIndex} onChange={(event) => setFileIndex(Number(event.currentTarget.value))}>
            {pr.files.map((item, index) => <option key={`${pr.repositoryId}#${pr.number}:${index}`} value={index}>{item.path}</option>)}
          </select>
        </label>
      ) : file ? <p className="hhp-task-diff-path">{file.path}</p> : null}
      {file ? (
        <div className="hhp-task-diff-versions">
          <TaskDiffCode file={file} side="before" />
          <TaskDiffCode file={file} side="after" />
        </div>
      ) : <p className="hhp-empty">此 PR 暂无可查看的文件变更。</p>}
    </div>
  )
}

export function HandheldTask({ taskId, onShowApproval, onVoice, draft, onDraftChange }: TaskProps) {
  const { state, dispatch, task, project, agentName, sendText } = useWorkspace()
  const item = task(taskId)
  const [layer, setLayer] = useState<TaskLayer | null>(null)
  const lastItem = useRef<HTMLDivElement>(null)
  const messages = state.messages.filter((message) => message.channelType === 'task' && message.channelId === taskId)
  const newestMessageId = messages.at(-1)?.id
  const previousMessageId = useRef(newestMessageId)

  useEffect(() => {
    const anchor = lastItem.current
    if (anchor && newestMessageId && newestMessageId !== previousMessageId.current && !anchor.closest('[hidden]')) {
      anchor.scrollIntoView({ block: 'nearest' })
    }
    previousMessageId.current = newestMessageId
  }, [newestMessageId])

  if (!item) return <p className="hhp-empty">此任务暂不可用。</p>

  const approvals = state.approvals.filter((approval) => approval.taskId === item.id)
  const pending = approvals.filter((approval) => approval.status === 'pending')
  const blocked = pending.some((approval) => approval.blocked)
  const events = state.events.filter((event) => event.taskId === item.id)
  const workflow = events.filter(({ type }) => type === 'assign' || type === 'step' || type === 'report').sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
  const delivery = events.filter((event) => event.type === 'acceptance' && !event.approvalId)
  const pullRequests = taskPullRequests(item, state.prs)
  const canReview = item.status === 'review' && pending.length === 0
  const progress = taskProgress(item, events)
  const owner = agentName(item.ownerAgentId) || '负责人'
  const thread: TaskEntry[] = [
    ...messages.map((message) => ({ type: 'message' as const, id: message.id, time: message.createdAt, message })),
    ...approvals.map((approval) => ({ type: 'approval' as const, id: approval.id, time: approval.requestedAt, approval })),
    ...delivery.map((event) => ({ type: 'delivery' as const, id: event.id, time: event.occurredAt, event })),
  ]
  thread.sort((a, b) => Date.parse(a.time) - Date.parse(b.time))

  return (
    <div className="hhp-task">
      <section className="hhp-card hhp-task-summary" aria-label="任务进度">
        <div className="hhp-task-summary-head">
          <div>
            <h2>{project(item.projectId)?.name ?? '项目'}</h2>
            <p className="hhp-muted">负责人 {owner}</p>
          </div>
          <button className="hhp-button is-quiet" type="button" onClick={() => setLayer({ type: 'related' })}>
            <IconLink size={16} /> 关联信息
          </button>
        </div>
        <div className="hhp-task-progress-label">
          <span className={`hhp-task-status${blocked || item.status === 'review' ? ' is-warning' : item.status === 'done' ? ' is-done' : ''}`}>
            {blocked ? '等待审批' : TASK_STATUS_LABEL[item.status]}
          </span>
          {pullRequests.length ? <PullRequestLinks pullRequests={pullRequests} onOpen={(pr) => setLayer({ type: 'diff', pr })} /> : null}
        </div>
        <div className="hhp-task-progress-run">
          <progress className="hhp-task-progress" aria-label="任务完成进度" value={progress} max={100} />
          <strong>{progress}%</strong>
        </div>
      </section>

      <details className="hhp-card hhp-task-workflow">
        <summary>
          <span>智能体工作流</span>
          <IconChevronDown size={18} />
        </summary>
        {workflow.length ? (
          <ol className="hhp-task-workflow-list">
            {workflow.map((event) => (
              <li key={event.id}>
                <div className="hhp-task-workflow-meta">
                  <strong>{agentName(event.actorId)}{event.recipientId ? ` → ${agentName(event.recipientId)}` : ''}</strong>
                  <time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
                </div>
                <p>{event.text}</p>
              </li>
            ))}
          </ol>
        ) : <p className="hhp-task-workflow-empty hhp-muted">暂无工作流记录。</p>}
      </details>

      <section className="hhp-task-thread" aria-label="任务对话">
        <h2 className="hhp-section-title">任务对话</h2>
        <div className="hhp-task-thread-list" role="log" aria-label="对话记录">
          {!thread.length && !canReview ? <p className="hhp-empty">还没有对话。你可以向{owner}发送消息。</p> : null}
          {thread.map((entry) => {
            if (entry.type === 'message') return <PortraitMessage key={entry.id} message={entry.message} />
            if (entry.type === 'approval') return <PortraitApproval key={entry.id} approval={entry.approval} onShowApproval={onShowApproval} />
            return (
              <PortraitMessage key={entry.id} message={{
                id: entry.id,
                channelType: 'task',
                channelId: item.id,
                authorId: entry.event.actorId,
                role: 'system',
                text: entry.event.text,
                createdAt: entry.time,
              }} />
            )
          })}
          {canReview ? (
            <article className="hhp-card hhp-task-delivery">
              <h3>交付验收</h3>
              <p>{item.latestUpdate || '交付已准备好，请核对产物。'}</p>
              <div className="hhp-task-delivery-actions">
                <button className="hhp-button" type="button" onClick={() => dispatch({ type: 'accept-delivery', taskId: item.id, allow: false })}>退回交付</button>
                <button className="hhp-button is-primary" type="button" onClick={() => dispatch({ type: 'accept-delivery', taskId: item.id, allow: true })}>通过验收</button>
              </div>
            </article>
          ) : null}
          <div ref={lastItem} className="hhp-task-scroll-anchor" />
        </div>
      </section>

      <div className="hhp-task-composer">
        <PortraitComposer
          value={draft}
          onChange={onDraftChange}
          onSend={(value) => {
            if (!value.trim()) return
            sendText('task', item.id, value, item.projectId)
            onDraftChange('')
          }}
          onVoice={onVoice}
          label={`发送给${owner}`}
        />
      </div>

      {layer ? (
        <PortraitDialog title={layer.type === 'related' ? '关联信息' : `PR #${layer.pr.number} · ${item.name}`} onClose={() => setLayer(null)}>
          {layer.type === 'related' ? (
            <div className="hhp-task-related">
              <dl>
                <div><dt>任务</dt><dd>{item.name}</dd></div>
                <div><dt>负责人</dt><dd>{owner}</dd></div>
                <div><dt>目标</dt><dd>{item.goal}</dd></div>
                {item.repositoryId ? <div><dt>仓库</dt><dd>{item.repositoryId}</dd></div> : null}
              </dl>
              {pullRequests.length ? <PullRequestLinks pullRequests={pullRequests} onOpen={(pr) => setLayer({ type: 'diff', pr })} /> : null}
            </div>
          ) : <TaskDiff key={`${layer.pr.repositoryId}#${layer.pr.number}`} pr={layer.pr} />}
        </PortraitDialog>
      ) : null}
    </div>
  )
}
