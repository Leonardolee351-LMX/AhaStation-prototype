import { IconPlus } from '../icons'
import { ATTENTION_LABEL, attentionItems, countByStatus, formatWait, uniqueOwners } from '../lib'
import { useWorkspace } from '../store'
import { openAgentInspect, isInspectableAgent } from '../components/AgentInspect'
import type { Project, TaskStatus } from '../types'
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from '../types'
import { SurfaceLogo, ViewTitle } from '../components/SurfaceLogo'
import { AvatarStack, Badge, Button } from '../ui'

export function ProjectRoom() {
  const { state, dispatch, agent, openBoard, openTask, pendingOf } = useWorkspace()
  const visible = state.projects
  const totalTasks = visible.reduce(
    (sum, project) => sum + state.tasks.filter((task) => task.projectId === project.id).length,
    0,
  )
  const layoutClass = visible.length <= 1 ? 'is-one' : visible.length === 2 ? 'is-two' : 'is-many'

  return (
    <section className="aha-page aha-roomview">
      <header className="aha-view-head">
        <ViewTitle kind="room" kicker="工作区首页" title="项目室">
          <p className="aha-lead">
            当前共 {visible.length} 个项目，共 {totalTasks} 项任务。点击项目进入任务面板，关注卡可直达任务会话。
          </p>
        </ViewTitle>
        <div className="aha-view-actions">
          <Button variant="secondary" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'local-scan', mode: 'scan' } })}>
            扫描本地工程
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'local-scan', mode: 'cite' } })}>
            引用文件夹
          </Button>
          <Button variant="primary" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-project' } })}>
            <IconPlus size={16} />
            新建项目
          </Button>
        </div>
      </header>
      <div className={`aha-room-grid ${layoutClass}`}>
        {visible.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            compact={visible.length >= 3}
            onOpen={() => openBoard(project.id)}
            onTask={openTask}
            onColumn={(column) => openBoard(project.id, column)}
            agents={uniqueOwners(state.tasks, project.id)
              .map((id) => agent(id))
              .filter((item): item is NonNullable<typeof item> => Boolean(item))}
            pendingCount={pendingOf(project.id).length}
            busy={state.tasks.some((task) => task.projectId === project.id && task.status === 'doing')}
            reviewCount={state.tasks.filter((task) => task.projectId === project.id && task.status === 'review').length}
          />
        ))}
      </div>
    </section>
  )
}

function projectPace(pendingCount: number, reviewCount: number, busy: boolean) {
  if (pendingCount) return { label: `${pendingCount} 项待核对`, tone: 'pending' as const }
  if (reviewCount) return { label: `${reviewCount} 项待验收`, tone: 'review' as const }
  if (busy) return { label: '忙碌', tone: 'busy' as const }
  return { label: '空闲', tone: 'idle' as const }
}

function ProjectCard({
  project,
  compact,
  onOpen,
  onTask,
  onColumn,
  agents,
  pendingCount,
  busy,
  reviewCount,
}: {
  project: Project
  compact: boolean
  onOpen: () => void
  onTask: (id: string) => void
  onColumn: (column: TaskStatus) => void
  agents: NonNullable<ReturnType<ReturnType<typeof useWorkspace>['agent']>>[]
  pendingCount: number
  busy: boolean
  reviewCount: number
}) {
  const pace = projectPace(pendingCount, reviewCount, busy)
  const { state, dispatch } = useWorkspace()
  const counts = countByStatus(state.tasks, project.id)
  const taskCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const limit = compact ? 1 : 2
  const items = attentionItems(project.id, state.tasks, state.approvals, limit)

  return (
    <article className="aha-project-card">
      <div className="aha-project-entry">
        <div className="aha-project-entry-head">
          <button type="button" className="aha-project-entry-open" onClick={onOpen}>
            <div className="aha-project-entry-title">
              <SurfaceLogo kind="project" size={32} />
              <div className="aha-project-entry-copy">
                <h2>{project.name}</h2>
                <p className="aha-muted">{project.path}</p>
              </div>
            </div>
          </button>
          {agents.length ? (
            <AvatarStack
              agents={agents}
              onSelect={(id) => {
                const item = agents.find((agent) => agent.id === id)
                if (isInspectableAgent(item)) openAgentInspect(dispatch, id)
              }}
            />
          ) : null}
        </div>
        <button type="button" className="aha-project-meta-open" onClick={onOpen}>
          <div className="aha-project-meta">
            <span>{taskCount} 项任务</span>
            <span className={`aha-project-pace is-${pace.tone}`}>{pace.label}</span>
          </div>
        </button>
      </div>
      {compact ? (
        <ul className="aha-status-counts">
          {TASK_STATUS_ORDER.map((status) => (
            <li key={status}>
              <button type="button" onClick={() => onColumn(status)}>
                <span>{TASK_STATUS_LABEL[status]}</span>
                <strong>{counts[status]}</strong>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="aha-stacks">
          {TASK_STATUS_ORDER.map((status) => {
            const stack = state.tasks.filter((task) => task.projectId === project.id && task.status === status)
            return (
              <div key={status} className="aha-stack">
                <button type="button" className="aha-stack-head" onClick={() => onColumn(status)}>
                  {TASK_STATUS_LABEL[status]}
                  <span>{stack.length}</span>
                </button>
                {stack[0] ? (
                  <button type="button" className="aha-stack-card" onClick={() => onTask(stack[0].id)}>
                    {stack[0].name}
                  </button>
                ) : (
                  <p className="aha-stack-empty">无</p>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="aha-attention-list">
        {items.length === 0 ? <p className={`aha-project-pace is-${pace.tone}`}>{pace.label}</p> : null}
        {items.map((item) => (
          <article
            key={`${item.kind}-${item.task.id}`}
            className={`aha-attention${item.kind === 'approval' ? ' is-pending' : ''}`}
          >
            <button type="button" className="aha-attention-main" onClick={() => onTask(item.task.id)}>
              <div className="aha-attention-top">
                <Badge tone={item.kind === 'approval' ? 'warning' : item.kind === 'review' ? 'success' : 'soft'}>
                  {ATTENTION_LABEL[item.kind]}
                </Badge>
                {item.approval ? <span>{formatWait(item.approval.requestedAt)}</span> : null}
              </div>
              <h3>{item.task.name}</h3>
              <p>{item.approval?.title ?? item.task.latestUpdate}</p>
            </button>
            <div className="aha-attention-foot">
              <Button size="sm" variant="ghost" onClick={() => onTask(item.task.id)}>
                查看任务
              </Button>
            </div>
          </article>
        ))}
      </div>
    </article>
  )
}
