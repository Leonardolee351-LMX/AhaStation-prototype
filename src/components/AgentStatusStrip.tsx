import { IconPlus } from '../icons'
import { pendingApprovals } from '../lib'
import { HOST_ID, YOU_AGENT, YOU_ID, useWorkspace } from '../store'
import { isInspectableAgent, openAgentInspect } from './AgentInspect'
import type { Agent, Approval, Task } from '../types'
import { Avatar } from '../ui'
import { TaskProcess, eventsForTask } from './TaskProcess'

type WorkKind = 'pending' | 'doing' | 'review' | 'idle' | 'listening' | 'online'

type WorkState = {
  kind: WorkKind
  label: string
  taskId?: string
}

function workStateFor(
  agentId: string,
  tasks: Task[],
  approvals: Approval[],
  listening: boolean,
): WorkState {
  if (agentId === YOU_ID) {
    return listening ? { kind: 'listening', label: '正在听' } : { kind: 'online', label: '在线' }
  }
  const mine = tasks.filter((task) => task.ownerAgentId === agentId)
  const pending = approvals.find((item) => mine.some((task) => task.id === item.taskId))
  if (pending) return { kind: 'pending', label: '待审批', taskId: pending.taskId }
  const doing = mine.find((task) => task.status === 'doing')
  if (doing) return { kind: 'doing', label: '进行中', taskId: doing.id }
  const review = mine.find((task) => task.status === 'review')
  if (review) return { kind: 'review', label: '待验收', taskId: review.id }
  return { kind: 'idle', label: '空闲' }
}

function projectAgents(agents: Agent[], tasks: Task[], projectId: string) {
  const ids: string[] = []
  const add = (id: string) => {
    if (!id || ids.includes(id)) return
    ids.push(id)
  }
  add(YOU_ID)
  for (const agent of agents) {
    if (agent.id === YOU_ID || agent.id === HOST_ID) continue
    if (agent.projectId === projectId) add(agent.id)
  }
  for (const task of tasks) add(task.ownerAgentId)
  return ids
    .map((id) => (id === YOU_ID ? YOU_AGENT : agents.find((item) => item.id === id)))
    .filter((item): item is Agent => Boolean(item))
}

export function AgentStatusStrip({ projectId }: { projectId: string }) {
  const { state, agent, dispatch, openTask } = useWorkspace()
  const tasks = state.tasks.filter((task) => task.projectId === projectId)
  const approvals = pendingApprovals(state.approvals, state.tasks, projectId)
  const listening = state.voice?.phase === 'listening'
  const roster = projectAgents(state.agents, tasks, projectId)

  return (
    <div className="aha-agent-strip" role="list" aria-label="智能体当前工作状态">
      {roster.map((item) => {
        const resolved = item.id === YOU_ID ? YOU_AGENT : (agent(item.id) ?? item)
        const work = workStateFor(item.id, tasks, approvals, listening)
        const clickable = Boolean(work.taskId)
        const inspectable = isInspectableAgent(resolved)
        return (
          <div
            key={item.id}
            role="listitem"
            className={`aha-agent-tile is-${work.kind}${clickable ? '' : ' is-static'}`}
            title={`${resolved.name} · ${work.label}`}
          >
            {inspectable ? (
              <button
                type="button"
                className="aha-agent-tile-peek"
                onClick={() => openAgentInspect(dispatch, resolved.id)}
              >
                <span className="aha-agent-tile-name">{resolved.name}</span>
                <Avatar agent={resolved} size="lg" />
              </button>
            ) : (
              <span className="aha-agent-tile-peek is-static">
                <span className="aha-agent-tile-name">{resolved.name}</span>
                <Avatar agent={resolved} size="lg" />
              </span>
            )}
            {work.taskId ? (
              <button type="button" className="aha-agent-tile-status" onClick={() => openTask(work.taskId!)}>
                {work.label}
              </button>
            ) : (
              <span className="aha-agent-tile-status">{work.label}</span>
            )}
            {work.taskId
              ? (() => {
                  const task = tasks.find((item) => item.id === work.taskId)
                  return task ? <TaskProcess task={task} events={eventsForTask(state.events, task.id)} variant="tile" /> : null
                })()
              : null}
          </div>
        )
      })}
      <button
        type="button"
        className="aha-agent-tile aha-agent-tile--add"
        aria-label="添加智能体"
        onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-agent' } })}
      >
        <IconPlus size={24} />
      </button>
    </div>
  )
}
