import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PuzzleCompanion } from '../components/PuzzleCompanion'
import { HOST_ID, YOU_ID } from '../data'
import { IconAt, IconChevronDown, IconChevronRight, IconClone, IconFolder, IconPlus } from '../icons'
import { nowIso, sameName, uid } from '../lib'
import { buildProject, useWorkspace } from '../store'
import { TASK_STATUS_LABEL, type Agent, type Approval, type Project, type ProjectSource, type Task, type TaskStatus } from '../types'
import {
  PortraitApproval,
  PortraitComposer,
  PortraitDialog,
  PortraitMessage,
  taskProgress,
} from './PortraitUI'
import './handheld-projects.css'

const SOURCES = [
  { value: 'blank', label: '新建空项目', Icon: IconPlus },
  { value: 'local', label: '打开文件夹', Icon: IconFolder },
  { value: 'clone', label: 'Git 克隆', Icon: IconClone },
] as const

const TASK_FILTERS = ['all', 'todo', 'doing', 'review', 'done'] as const
const OVERVIEW_ORDER: Record<TaskStatus, number> = { doing: 1, todo: 2, done: 3, review: 4 }
type Workspace = ReturnType<typeof useWorkspace>

function workerIds(tasks: Task[]) {
  return [...new Set(tasks.filter((task) => task.status === 'doing').map((task) => task.ownerAgentId))]
    .filter((id) => id !== HOST_ID && id !== YOU_ID)
}

function openProjectDiscussion(workspace: Workspace, project: Project) {
  if (workspace.state.discussions.some((item) => item.projectId === project.id && !item.taskId)) return
  const tasks = workspace.state.tasks.filter((task) => task.projectId === project.id)
  workspace.dispatch({
    type: 'create-discussion',
    discussion: {
      id: uid('disc'),
      projectId: project.id,
      title: `${project.name}讨论`,
      goal: '',
      startedAt: nowIso(),
      participantIds: [YOU_ID, HOST_ID, ...workerIds(tasks)],
      relatedTaskIds: tasks.map((task) => task.id),
      invitedIds: [],
      mentionedIds: [],
    },
  })
}

export function sendHandheldDiscussionText(workspace: Workspace, projectId: string, text: string) {
  const { state, dispatch, sendText, agent } = workspace
  const discussion = state.discussions.find((item) => item.projectId === projectId && !item.taskId)
  const note = text.trim()
  if (!discussion || !note) return

  const mention = discussion.participantIds
    .filter((id) => id !== YOU_ID && id !== HOST_ID)
    .map(agent)
    .filter((person): person is Agent => Boolean(person))
    .sort((a, b) => b.name.length - a.name.length)
    .find((person) => note.includes(`@${person.name}`) || note.includes(`@${person.slug}`))
  const wantsTask = /(?:新建|创建|新增|派发|安排|分派|起草|整理|提议|拆分).{0,18}(?:任务|待办)|(?:任务|待办).{0,12}(?:新建|派发|提议)/u.test(note)
  if (!wantsTask && !mention) {
    sendText('discussion', discussion.id, note, projectId)
    return
  }
  dispatch({ type: 'send-message', channelType: 'discussion', channelId: discussion.id, projectId, text: note })

  if (wantsTask) {
    if (state.proposals.some((item) => item.discussionId === discussion.id && item.status === 'pending')) {
      dispatch({ type: 'toast', message: '请先处理当前的任务提议。' })
      return
    }
    const assignee = mention?.id
      ?? discussion.participantIds.find((id) => id !== HOST_ID && id !== YOU_ID && agent(id))
      ?? state.agents.find((person) => person.projectId === projectId)?.id
      ?? state.agents.find((person) => person.id !== HOST_ID && person.id !== YOU_ID)?.id
      ?? HOST_ID
    const quotedTitle = note.match(/[「“]([^」”]+)[」”]/u)?.[1]
    const requestedTitle = note.replace(/^.*?(?:任务|待办)[：:\s]*/u, '').trim()
    const name = (quotedTitle || requestedTitle || discussion.title).slice(0, 40).replace(/[。！？!?]$/u, '')
    dispatch({
      type: 'add-proposal',
      proposal: {
        id: uid('prop'),
        discussionId: discussion.id,
        projectId,
        newTask: true,
        draftName: name,
        ownerAgentId: assignee,
        goal: note,
        acceptance: '交付结果符合讨论中约定的目标。',
        status: 'pending',
      },
      note: '我整理了一条任务提议，请确认负责人和目标后派发。',
    })
    return
  }

  if (mention) {
    dispatch({
      type: 'send-message',
      channelType: 'discussion',
      channelId: discussion.id,
      projectId,
      text: '收到，我会结合这个项目的目标补充看法。',
      authorId: mention.id,
      role: 'agent',
    })
  }
}

function ProjectTaskRow({
  task,
  pending,
  overview = false,
  onOpen,
}: {
  task: Task
  pending: boolean
  overview?: boolean
  onOpen: () => void
}) {
  const { state, agentName } = useWorkspace()
  const status = pending ? '待审批' : overview && task.status === 'todo' ? '待开始' : TASK_STATUS_LABEL[task.status]
  return (
    <button type="button" className={`hhp-project-task${overview ? ' is-overview' : ''}`} onClick={onOpen}>
      <span className="hhp-project-task-copy">
        <strong>{task.name}</strong>
        <small>{agentName(task.ownerAgentId)}</small>
      </span>
      <span className="hhp-project-task-meta">
        <span className={`hhp-project-status is-${pending ? 'pending' : task.status}`}>{status}</span>
        {overview ? <small>{taskProgress(task, state.events)}%</small> : null}
      </span>
      <IconChevronRight size={16} />
    </button>
  )
}

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const { state, dispatch } = useWorkspace()
  const [source, setSource] = useState<ProjectSource>('blank')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState<{ field: 'name' | 'location'; message: string } | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const locationLabel = source === 'local' ? '工作设备上的文件夹路径' : '仓库地址'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = name.trim()
    const target = location.trim()
    const problem = !title
      ? { field: 'name' as const, message: '请填写项目名称。' }
      : state.projects.some((project) => sameName(title, project.name))
        ? { field: 'name' as const, message: '已存在同名项目。' }
        : source !== 'blank' && !target
          ? { field: 'location' as const, message: `请填写${locationLabel}。` }
          : null
    if (problem) {
      setError(problem)
      const field = problem.field === 'name' ? nameRef : locationRef
      field.current?.focus()
      return
    }

    const project = {
      ...buildProject({
        source,
        name: title,
        path: source === 'local' ? target : '',
        repository: source === 'clone' ? target : '',
        location: '',
        entry: 'discussion',
      }),
      name: title,
    }
    dispatch({ type: 'create-project', project, entry: 'discussion' })
    onCreate(project.id)
  }

  return (
    <PortraitDialog title="新建项目" onClose={onClose}>
      <form className="hhp-project-form" onSubmit={submit} noValidate>
        <fieldset className="hhp-project-sources">
          <legend>项目来源</legend>
          {SOURCES.map(({ value, label, Icon }) => (
            <label key={value} className={source === value ? 'is-selected' : undefined}>
              <input
                type="radio"
                name="handheld-project-source"
                checked={source === value}
                onChange={() => {
                  setSource(value)
                  setLocation('')
                  if (error?.field === 'location') setError(null)
                }}
              />
              <Icon size={16} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <label className="hhp-project-field">
          <span>项目名称</span>
          <input
            ref={nameRef}
            value={name}
            maxLength={40}
            placeholder="输入项目名称"
            aria-required="true"
            aria-invalid={error?.field === 'name'}
            aria-describedby={error?.field === 'name' ? 'hhp-project-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              if (error?.field === 'name') setError(null)
            }}
          />
          {error?.field === 'name' ? <small id="hhp-project-name-error" role="alert">{error.message}</small> : null}
        </label>
        {source !== 'blank' ? (
          <label className="hhp-project-field">
            <span>{locationLabel}</span>
            <input
              ref={locationRef}
              value={location}
              maxLength={250}
              placeholder={source === 'local' ? '~/Projects/AhaStation' : 'owner/repo、HTTPS 或 SSH'}
              aria-required="true"
              aria-invalid={error?.field === 'location'}
              aria-describedby={error?.field === 'location' ? 'hhp-project-location-error' : undefined}
              onChange={(event) => {
                setLocation(event.target.value)
                if (error?.field === 'location') setError(null)
              }}
            />
            {error?.field === 'location' ? <small id="hhp-project-location-error" role="alert">{error.message}</small> : null}
          </label>
        ) : null}
        <div className="hhp-project-form-actions">
          <button type="button" className="hhp-button is-quiet" onClick={onClose}>取消</button>
          <button type="submit" className="hhp-button is-primary">创建项目</button>
        </div>
      </form>
    </PortraitDialog>
  )
}

export function HandheldProjects({
  onDiscussion,
  onTask,
}: {
  onDiscussion: (projectId: string) => void
  onTask: (taskId: string) => void
}) {
  const workspace = useWorkspace()
  const { state, pendingOf, dispatch } = workspace
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [newest, setNewest] = useState<string | null>(null)
  const newProjectRow = useRef<HTMLButtonElement>(null)
  const projects = [...state.projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

  useEffect(() => {
    if (!newest) return
    const frame = window.requestAnimationFrame(() => {
      newProjectRow.current?.focus({ preventScroll: true })
      newProjectRow.current?.scrollIntoView({ block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [newest])

  return (
    <div className="hhp-projects">
      <div className="hhp-project-tools">
        <button type="button" className="hhp-button is-primary" onClick={() => setCreating(true)}>
          <IconPlus size={16} />
          新建项目
        </button>
      </div>
      {projects.length ? (
        <ul className="hhp-project-list">
          {projects.map((project) => {
            const pending = new Set(pendingOf(project.id).map((approval) => approval.taskId))
            const overview = state.tasks
              .filter((task) => task.projectId === project.id && task.ownerAgentId !== HOST_ID && task.ownerAgentId !== YOU_ID)
              .filter((task) => pending.has(task.id) || task.status !== 'review')
              .sort((a, b) => (pending.has(a.id) ? 0 : OVERVIEW_ORDER[a.status]) - (pending.has(b.id) ? 0 : OVERVIEW_ORDER[b.status]))
              .slice(0, 3)
            const expanded = !collapsed.includes(project.id)
            const overviewId = `hhp-overview-${project.id}`
            return (
              <li key={project.id} className="hhp-project-item">
                <div className="hhp-project-item-head">
                  <button
                    ref={project.id === newest ? newProjectRow : undefined}
                    type="button"
                    className="hhp-project-title-link"
                    onClick={() => {
                      openProjectDiscussion(workspace, project)
                      onDiscussion(project.id)
                    }}
                  >
                    <span
                      className={`hhp-project-dot${pending.size ? ' is-pending' : ''}`}
                      role="img"
                      aria-label={pending.size ? '有待审批事项' : '暂无待审批事项'}
                    />
                    <strong>{project.name}</strong>
                    <IconChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="hhp-project-toggle"
                    aria-label={`${expanded ? '收起' : '展开'}${project.name}任务概览`}
                    aria-controls={overviewId}
                    aria-expanded={expanded}
                    onClick={() => setCollapsed((items) => expanded ? [...items, project.id] : items.filter((id) => id !== project.id))}
                  >
                    <IconChevronDown size={18} />
                  </button>
                </div>
                <div id={overviewId} className="hhp-project-overview" hidden={!expanded}>
                  {overview.length ? (
                    <ul>
                      {overview.map((task) => (
                        <li key={task.id}>
                          <ProjectTaskRow task={task} pending={pending.has(task.id)} overview onOpen={() => onTask(task.id)} />
                        </li>
                      ))}
                    </ul>
                  ) : <p className="hhp-project-overview-empty">暂无子智能体任务</p>}
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="hhp-empty">暂无项目，可以先创建一个项目。</p>}
      {creating ? (
        <NewProjectDialog
          onClose={() => setCreating(false)}
          onCreate={(id) => {
            setCreating(false)
            setNewest(id)
            dispatch({ type: 'toast', message: '项目已创建。' })
          }}
        />
      ) : null}
    </div>
  )
}

function DiscussionProposal({ id, onTask }: { id: string; onTask: (id: string) => void }) {
  const { state, dispatch, agentName } = useWorkspace()
  const proposal = state.proposals.find((item) => item.id === id)
  if (!proposal) return null

  return (
    <article className="hhp-card hhp-project-proposal">
      <p className={`hhp-project-status${proposal.status === 'pending' ? ' is-pending' : ''}`}>
        {proposal.status === 'pending' ? '任务提议' : proposal.status === 'confirmed' ? '已派发' : '已取消'}
      </p>
      <h3>{proposal.draftName ?? proposal.goal}</h3>
      <p className="hhp-muted">负责人 · {agentName(proposal.ownerAgentId)}</p>
      {proposal.draftName && proposal.goal !== proposal.draftName ? <p>{proposal.goal}</p> : null}
      {proposal.status === 'pending' ? (
        <div className="hhp-project-form-actions">
          <button
            className="hhp-button is-quiet"
            type="button"
            onClick={() => dispatch({ type: 'resolve-proposal', proposalId: id, decision: 'discarded' })}
          >取消提议</button>
          <button
            className="hhp-button is-primary"
            type="button"
            onClick={() => dispatch({ type: 'resolve-proposal', proposalId: id, decision: 'confirmed' })}
          >确认并派发</button>
        </div>
      ) : proposal.status === 'confirmed' && proposal.taskId ? (
        <div className="hhp-project-form-actions">
          <button className="hhp-button is-quiet" type="button" onClick={() => onTask(proposal.taskId!)}>查看任务</button>
        </div>
      ) : null}
    </article>
  )
}

function DiscussionApprovals({
  pending,
  onTask,
  onShowApproval,
}: {
  pending: Approval[]
  onTask: (id: string) => void
  onShowApproval: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!pending.length) return null

  return (
    <section className="hhp-project-approval-stack" aria-label="项目待审批">
      <h2 className="hhp-section-title">待审批 <span>{pending.length}</span></h2>
      {(expanded ? pending : pending.slice(0, 1)).map((approval) => (
        <PortraitApproval key={approval.id} approval={approval} onTask={onTask} onShowApproval={onShowApproval} />
      ))}
      {pending.length > 1 ? (
        <button
          type="button"
          className="hhp-button is-quiet hhp-project-approval-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起其余审批' : `展开其余 ${pending.length - 1} 条审批`}
          <IconChevronDown size={16} />
        </button>
      ) : null}
    </section>
  )
}

export function HandheldDiscussion({
  projectId,
  onTask,
  onShowApproval,
  draft,
  onDraftChange,
}: {
  projectId: string
  onTask: (taskId: string) => void
  onShowApproval: (id: string) => void
  draft: string
  onDraftChange: (value: string) => void
}) {
  const workspace = useWorkspace()
  const { state, agent, dispatch, pendingOf } = workspace
  const [inviting, setInviting] = useState(false)
  const [mentioning, setMentioning] = useState(false)
  const composer = useRef<HTMLDivElement>(null)
  const discussion = state.discussions.find((item) => item.projectId === projectId && !item.taskId)

  const logEnd = useRef<HTMLDivElement>(null)
  const messages = state.messages.filter((item) => item.channelType === 'discussion' && item.channelId === discussion?.id)
  const lastMessage = messages.at(-1)
  const lastUserId = messages.findLast((item) => item.role === 'you')?.id
  const priorActivity = useRef({ lastMessage, lastUserId })

  useEffect(() => {
    const prior = priorActivity.current
    priorActivity.current = { lastMessage, lastUserId }
    const userJustSent = lastUserId !== prior.lastUserId
    const replyJustArrived = lastMessage !== prior.lastMessage && prior.lastMessage?.role === 'you'
    if ((userJustSent || replyJustArrived) && !logEnd.current?.closest('[hidden]')) {
      logEnd.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [lastMessage, lastUserId])

  if (!discussion) return <p className="hhp-empty">暂无项目讨论。</p>

  const tasks = state.tasks.filter((task) => task.projectId === projectId)
  const pending = pendingOf(projectId)
  const priority = tasks.find((task) => task.id === pending[0]?.taskId)
    ?? tasks.find((task) => task.status === 'doing')
    ?? tasks.find((task) => task.status === 'review')
    ?? tasks[0]
  const priorityLabel = priority
    ? pending.some((item) => item.taskId === priority.id) ? '待审批' : TASK_STATUS_LABEL[priority.status]
    : null
  const people = discussion.participantIds.filter((id) => id !== YOU_ID).map(agent).filter((person): person is Agent => Boolean(person))
  const mentionable = people.filter((person) => person.id !== HOST_ID)
  const inviteList = state.agents.filter((person) => person.id !== YOU_ID && person.id !== HOST_ID && !discussion.participantIds.includes(person.id))
  const results = state.approvals.filter((item) => item.status !== 'pending' && tasks.some((task) => task.id === item.taskId))

  const mention = (person: Agent) => {
    onDraftChange(`${draft.trimEnd()}${draft.trimEnd() ? ' ' : ''}@${person.name} `.slice(0, 600))
    setMentioning(false)
    composer.current?.querySelector<HTMLElement>('textarea, input')?.focus()
  }

  return (
    <div className="hhp-project-discussion">
      <div className="hhp-project-assistant">
        <PuzzleCompanion mood={pending.length ? 'waiting' : 'present'} size={48} />
        <div>
          <h2>Aha 助理</h2>
          {priority ? (
            <button type="button" className="hhp-project-priority" onClick={() => onTask(priority.id)}>
              <span>{priority.name}</span>
              <span>{taskProgress(priority, state.events)}% · {priorityLabel}</span>
              <IconChevronRight size={16} />
            </button>
          ) : <p>项目暂无任务</p>}
        </div>
      </div>
      <div className="hhp-project-discussion-body">
        <div className="hhp-project-people">
          <ul aria-label="讨论参与者">
            {people.map((person) => <li key={person.id}>{person.id === HOST_ID ? 'Aha Host' : person.name}</li>)}
          </ul>
          <button type="button" className="hhp-button is-quiet" onClick={() => setInviting(true)}>邀请智能体</button>
        </div>
        <DiscussionApprovals pending={pending} onTask={onTask} onShowApproval={onShowApproval} />
        <section className="hhp-project-log" aria-label="项目讨论记录">
          {messages.length ? messages.map((message) => (
            <div className="hhp-project-log-item" key={message.id}>
              <PortraitMessage message={message} />
              {message.proposalId ? <DiscussionProposal id={message.proposalId} onTask={onTask} /> : null}
            </div>
          )) : <p className="hhp-empty">暂无讨论记录。</p>}
          <div className="hhp-project-log-end" ref={logEnd} />
        </section>
        {results.length ? (
          <section className="hhp-project-approval-stack" aria-label="已处理审批">
            <h2 className="hhp-section-title">已处理审批</h2>
            {results.map((approval) => (
              <PortraitApproval key={approval.id} approval={approval} onTask={onTask} onShowApproval={onShowApproval} />
            ))}
          </section>
        ) : null}
      </div>
      <div className="hhp-project-composer" ref={composer}>
        {mentioning && mentionable.length ? (
          <div className="hhp-project-mentions" id="hhp-discussion-mentions" aria-label="选择点名对象">
            {mentionable.map((person) => (
              <button key={person.id} className="hhp-button is-quiet" type="button" onClick={() => mention(person)}>
                @{person.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="hhp-project-composer-row">
          {mentionable.length ? (
            <button
              className="hhp-icon-button"
              type="button"
              aria-label="点名智能体"
              aria-expanded={mentioning}
              onClick={() => setMentioning((open) => !open)}
            >
              <IconAt size={18} />
            </button>
          ) : null}
          <PortraitComposer
            value={draft}
            onChange={onDraftChange}
            onSend={(value) => {
              sendHandheldDiscussionText(workspace, projectId, value)
              onDraftChange('')
              setMentioning(false)
            }}
            label="发消息给项目讨论"
          />
        </div>
      </div>
      {inviting ? (
        <PortraitDialog title="邀请智能体" onClose={() => setInviting(false)}>
          {inviteList.length ? (
            <ul className="hhp-project-invite">
              {inviteList.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'invite-agent', discussionId: discussion.id, agentId: person.id })
                      setInviting(false)
                    }}
                  >
                    <span><strong>{person.name}</strong><small>{person.role ?? person.description}</small></span>
                    <IconPlus size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="hhp-empty">所有智能体均已参加。</p>}
        </PortraitDialog>
      ) : null}
    </div>
  )
}

export function HandheldBoard({ projectId, onTask }: { projectId: string; onTask: (taskId: string) => void }) {
  const { state, project, pendingOf } = useWorkspace()
  const [filter, setFilter] = useState<(typeof TASK_FILTERS)[number]>('all')
  const context = project(projectId)
  const tasks = state.tasks.filter((task) => task.projectId === projectId)
  const pending = new Set(pendingOf(projectId).map((approval) => approval.taskId))
  const shown = tasks.filter((task) => filter === 'all' || task.status === filter)

  return (
    <div className="hhp-project-board">
      <div className="hhp-project-board-intro">
        <h2>{context?.name ?? '项目'}</h2>
        <p className="hhp-muted">{tasks.length} 项任务</p>
        {context?.source !== 'blank' && context?.path ? <p className="hhp-muted hhp-project-location">{context.path}</p> : null}
      </div>
      <div className="hhp-project-filters" role="group" aria-label="按任务状态筛选">
        {TASK_FILTERS.map((status) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {status === 'all' ? '全部' : TASK_STATUS_LABEL[status]}
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="hhp-project-board-list">
          {shown.map((task) => (
            <li key={task.id}><ProjectTaskRow task={task} pending={pending.has(task.id)} onOpen={() => onTask(task.id)} /></li>
          ))}
        </ul>
      ) : <p className="hhp-empty">{filter === 'all' ? '项目暂无任务。' : '此状态暂无任务。'}</p>}
    </div>
  )
}
