import { SKILL_CATALOG } from '../data'
import { HOST_ID, YOU_ID, useWorkspace, type Action } from '../store'
import type { Agent } from '../types'
import { Avatar, Dialog } from '../ui'
import type { Dispatch } from 'react'

const TOOL_LABELS: Record<string, string> = {
  'read-files': '读取项目文件',
  search: '搜索资料',
  review: '代码审查',
  'run-tests': '运行测试',
  summarize: '汇总进展',
}

function labelFor(id: string) {
  return SKILL_CATALOG.find((item) => item.id === id)?.name ?? TOOL_LABELS[id] ?? id
}

export function isInspectableAgent(agent: Agent | undefined | null): boolean {
  return Boolean(agent && agent.id !== YOU_ID && agent.id !== HOST_ID)
}

export function openAgentInspect(dispatch: Dispatch<Action>, agentId: string) {
  dispatch({ type: 'set-dialog', dialog: { type: 'inspect-agent', agentId } })
}

export function resolveSystemPrompt(agent: Agent) {
  if (agent.systemPrompt?.trim()) return agent.systemPrompt.trim()
  const role = agent.role ? `，职责是${agent.role}` : ''
  const detail = agent.description.trim()
  return `你是「${agent.name}」${role}。${detail || '按授权完成指派的工作，并及时回报进展。'}`
}

export function AgentInspectDialog({ agentId }: { agentId: string }) {
  const { agent, dispatch } = useWorkspace()
  const item = agent(agentId)
  if (!item) return null
  const model = [item.aiProvider, item.aiModel].filter(Boolean).join(' · ') || '未指定模型'
  const tools = item.tools.map(labelFor)
  const skills = item.skills.map(labelFor)
  return (
    <Dialog open title="子智能体" width="sm" onClose={() => dispatch({ type: 'set-dialog', dialog: null })}>
      <div className="aha-agent-inspect">
        <div className="aha-agent-inspect-hero">
          <Avatar agent={item} size="lg" />
          <div>
            <h3>{item.name}</h3>
            <p className="aha-muted">{item.role ?? '子智能体'}</p>
          </div>
        </div>
        <section>
          <h4>模型</h4>
          <p>{model}</p>
        </section>
        <section>
          <h4>后台运作提示词</h4>
          <pre>{resolveSystemPrompt(item)}</pre>
        </section>
        <section>
          <h4>能力</h4>
          {item.description ? <p>{item.description}</p> : null}
          {tools.length ? <p>工具：{tools.join('、')}</p> : null}
          {skills.length ? <p>技能：{skills.join('、')}</p> : null}
          {!item.description && !tools.length && !skills.length ? <p className="aha-muted">暂未配置能力。</p> : null}
        </section>
      </div>
    </Dialog>
  )
}
