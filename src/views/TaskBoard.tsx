import { useEffect, useRef } from 'react'
import { IconChevronLeft, IconChevronRight } from '../icons'
import { useWorkspace } from '../store'
import type { Task, TaskStatus } from '../types'
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from '../types'
import { AgentStatusStrip } from '../components/AgentStatusStrip'
import { ViewTitle } from '../components/SurfaceLogo'
import { TaskProcess, eventsForTask } from '../components/TaskProcess'
import { Badge, Button } from '../ui'

export function TaskBoard({ projectId }: { projectId: string }) {
  const { state, project, agent, openTask } = useWorkspace()
  const item = project(projectId)
  const tasks = state.tasks.filter((task) => task.projectId === projectId)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const focus = state.boardFocus
    if (!focus || focus.projectId !== projectId) return
    const col = scroller.current?.querySelector<HTMLElement>(`[data-col="${focus.column}"]`)
    col?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' })
  }, [projectId, state.boardFocus])

  function scroll(dir: -1 | 1) {
    const root = scroller.current
    if (!root) return
    const col = root.querySelector<HTMLElement>('[data-col]')
    const width = col ? col.getBoundingClientRect().width + 16 : 280
    root.scrollBy({ left: dir * width, behavior: 'smooth' })
  }

  const atStart = false
  const atEnd = false

  return (
    <section className="aha-page aha-boardview">
      <header className="aha-view-head">
        <ViewTitle kind="project" kicker="任务面板" title={item?.name ?? '项目'}>
          <p className="aha-lead">共 {tasks.length} 项任务。点击卡片打开任务会话。</p>
        </ViewTitle>
        <div className="aha-view-actions aha-board-nav">
          <Button size="sm" icon aria-label="向左一列" onClick={() => scroll(-1)} disabled={atStart}>
            <IconChevronLeft />
          </Button>
          <Button size="sm" icon aria-label="向右一列" onClick={() => scroll(1)} disabled={atEnd}>
            <IconChevronRight />
          </Button>
        </div>
      </header>
      <AgentStatusStrip projectId={projectId} />
      <div className="aha-board-scroll" ref={scroller}>
        {TASK_STATUS_ORDER.map((status) => {
          const list = tasks.filter((task) => task.status === status)
          return (
            <section key={status} className="aha-board-col" data-col={status}>
              <header>
                <h2>{TASK_STATUS_LABEL[status]}</h2>
                <span>{list.length}</span>
              </header>
              <ul>
                {list.length === 0 ? <li className="aha-empty-col">暂无任务</li> : null}
                {list.map((task) => (
                  <li key={task.id}>
                    <TaskCard task={task} projectName={item?.name ?? ''} ownerName={agent(task.ownerAgentId)?.name} onOpen={() => openTask(task.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function TaskCard({
  task,
  projectName,
  ownerName,
  onOpen,
}: {
  task: Task
  projectName: string
  ownerName?: string
  onOpen: () => void
}) {
  const { state, pendingOf } = useWorkspace()
  const pending = pendingOf(task.projectId).some((item) => item.taskId === task.id)
  return (
    <button type="button" className={`aha-taskcard${pending ? ' is-pending' : ''}`} onClick={onOpen}>
      <p className="aha-taskcard-project">{projectName}</p>
      <h3>{task.name}</h3>
      <p className="aha-muted">{task.repositoryId ?? '非代码任务'}</p>
      <TaskProcess task={task} events={eventsForTask(state.events, task.id)} variant="compact" showTitle={false} />
      <div className="aha-taskcard-foot">
        {task.pullRequests?.map((number) => (
          <Badge key={number}>PR #{number}</Badge>
        ))}
        {pending ? <Badge tone="warning">待审批</Badge> : null}
        {ownerName ? <span>{ownerName}</span> : null}
      </div>
    </button>
  )
}

export function statusOf(_status: TaskStatus) {
  return _status
}
