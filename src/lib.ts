import { HOST_ID, YOU_ID } from './data'
import type {
  Agent,
  Approval,
  AttentionKind,
  AvatarTone,
  Project,
  ProjectSource,
  Proposal,
  Tab,
  TabKind,
  Task,
  TaskStatus,
} from './types'
import { TASK_STATUS_ORDER } from './types'

const SHANGHAI = 'Asia/Shanghai'

export function nowIso() {
  return new Date().toLocaleString('sv-SE', { timeZone: SHANGHAI }).replace(' ', 'T') + '+08:00'
}

export function formatTime(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDateTime(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatRange(start: string, end?: string) {
  const startText = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(start))
  if (!end) return `${startText} 起`
  const endText = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(end))
  return `${startText} – ${endText}`
}

export function formatWait(iso: string, from = new Date()) {
  const ms = Math.max(0, from.getTime() - new Date(iso).getTime())
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `已等待 ${minutes} 分钟`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `已等待 ${hours} 小时`
  const days = Math.round(hours / 24)
  return `已等待 ${days} 天`
}

export function agentTone(agent: Agent | undefined): AvatarTone {
  if (!agent) return 'sub'
  if (agent.id === YOU_ID) return 'you'
  if (agent.id === HOST_ID) return 'host'
  if (agent.role?.includes('子')) return 'sub'
  return 'expert'
}

export function tabKey(kind: TabKind, id?: string, extra?: string) {
  switch (kind) {
    case 'room':
      return 'room'
    case 'host':
      return 'host'
    case 'history':
      return 'history'
    case 'settings':
      return 'settings'
    case 'board':
      return `board:${id}`
    case 'cli':
      return `cli:${id}`
    case 'discussion':
      return `discussion:${id}`
    case 'task':
      return `task:${id}`
    case 'task-file':
      return `task-file:${id}`
    case 'pr-diff':
      return `pr-diff:${id}`
    case 'repo-file':
      return `repo-file:${id}:${extra ?? ''}`
  }
}

export function upsertTab(tabs: Tab[], tab: Tab): Tab[] {
  const index = tabs.findIndex((item) => item.key === tab.key)
  if (index === -1) return [...tabs, tab]
  const next = tabs.slice()
  next[index] = { ...next[index], ...tab, key: tab.key }
  return next
}

export function closeTab(tabs: Tab[], key: string): { tabs: Tab[]; nextKey: string | null } {
  const index = tabs.findIndex((tab) => tab.key === key)
  if (index === -1) return { tabs, nextKey: tabs[0]?.key ?? null }
  const next = tabs.filter((tab) => tab.key !== key)
  if (next.length === 0) return { tabs: next, nextKey: null }
  const neighbor = tabs[index - 1] ?? next[0]
  return { tabs: next, nextKey: neighbor.key }
}

export function pendingApprovals(approvals: Approval[], tasks: Task[], projectId?: string) {
  return approvals
    .filter((item) => item.status === 'pending')
    .filter((item) => {
      if (!projectId) return true
      const task = tasks.find((row) => row.id === item.taskId)
      return task?.projectId === projectId
    })
    .sort((a, b) => {
      if (a.blocked !== b.blocked) return a.blocked ? -1 : 1
      return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    })
}

export type ReviewItem = {
  id: string
  taskId: string
  title: string
  badge: '阻塞' | '待审批' | '待验收'
  kindLabel: string
  agentName: string
  projectName: string
}

export function reviewQueue(approvals: Approval[], tasks: Task[], projects: Project[], agents: Agent[]): ReviewItem[] {
  const pending = pendingApprovals(approvals, tasks)
  const pendingTaskIds = new Set(pending.map((item) => item.taskId))
  const items: ReviewItem[] = []

  for (const approval of pending) {
    const task = tasks.find((row) => row.id === approval.taskId)
    const project = projects.find((row) => row.id === task?.projectId)
    const owner = agents.find((row) => row.id === task?.ownerAgentId)
    items.push({
      id: approval.id,
      taskId: approval.taskId,
      title: approval.title,
      badge: approval.blocked ? '阻塞' : '待审批',
      kindLabel: approval.kind,
      agentName: owner?.name ?? '智能体',
      projectName: project?.name ?? '',
    })
  }

  for (const task of tasks) {
    if (task.status !== 'review' || pendingTaskIds.has(task.id)) continue
    const project = projects.find((row) => row.id === task.projectId)
    const owner = agents.find((row) => row.id === task.ownerAgentId)
    items.push({
      id: `accept:${task.id}`,
      taskId: task.id,
      title: task.name,
      badge: '待验收',
      kindLabel: '验收',
      agentName: owner?.name ?? '智能体',
      projectName: project?.name ?? '',
    })
  }

  return items
}

export function nextReviewItem(items: ReviewItem[], currentTaskId?: string) {
  if (items.length === 0) return null
  const index = currentTaskId ? items.findIndex((item) => item.taskId === currentTaskId) : -1
  if (index === -1) return items[0]
  return items[(index + 1) % items.length] ?? items[0]
}

export function projectTasks(tasks: Task[], projectId: string) {
  return tasks.filter((task) => task.projectId === projectId)
}

export function countByStatus(tasks: Task[], projectId: string): Record<TaskStatus, number> {
  const counts = { todo: 0, doing: 0, review: 0, done: 0 }
  for (const task of projectTasks(tasks, projectId)) counts[task.status] += 1
  return counts
}

export type AttentionItem = {
  kind: AttentionKind
  task: Task
  approval?: Approval
}

export function attentionItems(
  projectId: string,
  tasks: Task[],
  approvals: Approval[],
  limit: number,
): AttentionItem[] {
  const project = projectTasks(tasks, projectId)
  const pending = pendingApprovals(approvals, tasks, projectId)
  const items: AttentionItem[] = []
  for (const approval of pending) {
    const task = project.find((row) => row.id === approval.taskId)
    if (task) items.push({ kind: 'approval', task, approval })
  }
  if (items.length < limit) {
    for (const task of project.filter((row) => row.status === 'review')) {
      if (items.some((item) => item.task.id === task.id)) continue
      items.push({ kind: 'review', task })
      if (items.length >= limit) break
    }
  }
  if (items.length < limit) {
    for (const task of project.filter((row) => row.status === 'doing')) {
      if (items.some((item) => item.task.id === task.id)) continue
      items.push({ kind: 'working', task })
      if (items.length >= limit) break
    }
  }
  return items.slice(0, limit)
}

export function attentionKind(items: AttentionItem[]): AttentionKind | null {
  return items[0]?.kind ?? null
}

export function uniqueOwners(tasks: Task[], projectId: string) {
  return [...new Set(projectTasks(tasks, projectId).map((task) => task.ownerAgentId))]
}

export function statusTopTask(tasks: Task[], projectId: string, status: TaskStatus) {
  return projectTasks(tasks, projectId).find((task) => task.status === status)
}

export function nextColumn(status: TaskStatus, dir: -1 | 1): TaskStatus | null {
  const index = TASK_STATUS_ORDER.indexOf(status) + dir
  return TASK_STATUS_ORDER[index] ?? null
}

export function normalizePath(input: string) {
  let value = input.trim()
  value = value.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(value) && value.length === 3) return value
  if (value.length > 1) value = value.replace(/\/+$/, '')
  return value
}

export function pathBasename(path: string) {
  const normalized = normalizePath(path)
  const parts = normalized.split('/').filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  return last.replace(/:$/, '')
}

export function isPlausiblePath(value: string) {
  const path = normalizePath(value)
  if (!path) return false
  if (path.length > 240) return false
  if (path.startsWith('~/')) return path.length > 2
  if (path.startsWith('/')) return path.length > 1
  if (/^[a-zA-Z]:\//.test(path)) return path.length > 3
  return false
}

export function isValidName(name: string) {
  if (!name.trim()) return false
  if (name.trim().length > 36) return false
  return !/[\\/:*?"<>|]/.test(name.trim())
}

export function sanitizeRepo(input: string) {
  let value = input.trim()
  value = value.replace(/[?#].*$/, '')
  value = value.replace(/^git\+/, '')
  value = value.replace(/\/\/([^/@]+)@/, '//')
  return value
}

export function isValidRepo(input: string) {
  const value = sanitizeRepo(input)
  if (!value || value.length > 240) return false
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return true
  if (/^https?:\/\/\S+/.test(value)) return true
  if (/^git@[\w.-]+:\S+/.test(value)) return true
  if (/^ssh:\/\/\S+/.test(value)) return true
  return false
}

export function repoProjectName(input: string) {
  const value = sanitizeRepo(input).replace(/\.git$/, '')
  const short = value.replace(/^git@[\w.-]+:/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/^ssh:\/\/[^/]+\//, '')
  return pathBasename(short) || 'new-project'
}

export function joinPath(location: string, name: string) {
  const root = normalizePath(location || '~/Projects')
  return `${root}/${name.trim()}`
}

export function sourceLabel(source: ProjectSource) {
  if (source === 'local') return '本机文件夹'
  if (source === 'clone') return 'Git 克隆'
  return '空项目'
}

export function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function findDuplicate(
  projects: Project[],
  opts: { name?: string; path?: string; repository?: string },
) {
  if (opts.name && projects.some((project) => sameName(project.name, opts.name!))) {
    return '已有同名项目，请换一个名称。'
  }
  if (opts.path) {
    const path = normalizePath(opts.path)
    if (projects.some((project) => normalizePath(project.path) === path)) {
      return '这个目录已经关联到现有项目。'
    }
  }
  if (opts.repository) {
    const repo = sanitizeRepo(opts.repository).replace(/\.git$/, '')
    if (
      projects.some(
        (project) => project.repository && sanitizeRepo(project.repository).replace(/\.git$/, '') === repo,
      )
    ) {
      return '这个仓库已经关联到现有项目。'
    }
  }
  return null
}

export function validateHostAddress(value: string) {
  const address = value.trim()
  if (!address) return '请填写连接地址。'
  if (address.length > 240) return '地址最多 240 个字符。'
  if (/[?#]/.test(address)) return '地址不要包含查询参数或片段。'
  if (/https?:\/\/[^/]+@/i.test(address)) return '地址不要嵌入凭据。'
  if (!/^https?:\/\/[^\s/]+/i.test(address)) return '请使用 HTTP 或 HTTPS 地址。'
  return null
}

export function slugify(name: string, existing: string[]) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'agent'
  let slug = base
  let i = 2
  while (existing.includes(slug)) {
    slug = `${base}-${i}`
    i += 1
  }
  return slug
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export const ATTENTION_LABEL: Record<AttentionKind, string> = {
  approval: '待审批',
  review: '待验收',
  working: '进行中',
}


export function buildBrief(state: { projects: Project[]; tasks: Task[]; approvals: Approval[] }) {
  const pending = pendingApprovals(state.approvals, state.tasks)
  const review = state.tasks.filter((task) => task.status === 'review')
  const doing = state.tasks.filter((task) => task.status === 'doing')
  const parts: string[] = []
  if (pending.length) {
    parts.push(`当前有 ${pending.length} 条待审批，优先处理「${pending[0].title}」。`)
  }
  if (review.length) {
    parts.push(`另有 ${review.length} 项待验收。`)
  }
  if (doing.length) {
    const project = state.projects.find((item) => item.id === doing[0].projectId)
    parts.push(`正在进行「${doing[0].name}」${project ? `（${project.name}）` : ''}。`)
  }
  return { text: parts.join(' ') || '目前没有待处理事项。' }
}


export function dayGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

const CARE_LINES: [number, string[]][] = [
  [5, [
    '还在忙的话，留意一下身体，能收就早点收。',
    '这么晚还开着，我在这儿陪你。累了就先歇一会儿吧。',
    '今天已经够辛苦了，要不要跟我说说还在惦记什么？',
  ]],
  [8, [
    '新的一天开始了，先慢慢热热身，别急着把自己排满。',
    '我在这儿。今天感觉怎么样，要不要先跟我说说？',
    '起来了就很好，我们按你的节奏来。',
  ]],
  [12, [
    '今天也加油干活，我在这儿看着项目，有事随时叫我。',
    '开始干活前，要不要先跟我说说你最近的状态？',
    '今天节奏可以稳一点，一件一件来。',
  ]],
  [14, [
    '忙了一上午，记得吃点东西，也适当休息一下。',
    '这会儿要是有点累，不妨先缓一缓再继续。',
    '午前还顺利吗？想聊两句也可以。',
  ]],
  [18, [
    '继续加油，也别绷太紧，累了就跟我说一声。',
    '要是状态一般，我们把接下来的事拆小一点。',
    '今天下午也稳稳推进就好，有想说的随时叫我。',
  ]],
  [21, [
    '今天辛苦了。要是还想再推一点，我陪着；累了就适当休息。',
    '晚饭后还好吗，要不要跟我说说最近的状态？',
    '白天的事可以先放一放，我们按你现在的精力来。',
  ]],
  [24, [
    '天不早了，能收尾就收尾，注意休息。',
    '还在的话我陪着你。累了就先放下，明天再来也很好。',
    '今天已经做了不少，要不要先跟我说说现在的感觉？',
  ]],
]

let sessionCare: { key: string; text: string } | null = null

export function careGreeting(date = new Date()) {
  const hello = dayGreeting(date)
  const hour = date.getHours()
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${hour}`
  if (sessionCare?.key === dayKey) return sessionCare.text
  const bucket = CARE_LINES.find(([end]) => hour < end)?.[1] ?? CARE_LINES[CARE_LINES.length - 1][1]
  const pick = (date.getDate() + hour) % bucket.length
  const text = `${hello}。${bucket[pick]}`
  sessionCare = { key: dayKey, text }
  return text
}


export type RailReviewEntry = {
  id: string
  badge: string
  title: string
  detail?: string
  tone: 'warning' | 'success' | 'soft'
  approvalId?: string
  proposalId?: string
  taskId?: string
}

export function collectRailReviews(
  approvals: Approval[],
  proposals: Proposal[],
  tasks: Task[],
  projects: Project[],
): { pending: RailReviewEntry[]; reviewed: RailReviewEntry[] } {
  const pending: RailReviewEntry[] = []
  const reviewed: RailReviewEntry[] = []

  for (const approval of pendingApprovals(approvals, tasks)) {
    const task = tasks.find((item) => item.id === approval.taskId)
    const project = projects.find((item) => item.id === task?.projectId)
    pending.push({
      id: approval.id,
      badge: approval.blocked ? '阻塞' : '待审批',
      title: approval.title,
      detail: project?.name ?? task?.name,
      tone: 'warning',
      approvalId: approval.id,
      taskId: approval.taskId,
    })
  }

  for (const proposal of proposals) {
    if (proposal.status !== 'pending') continue
    pending.push({
      id: proposal.id,
      badge: '待确认提议',
      title: proposal.draftName ?? proposal.goal,
      detail: proposal.goal,
      tone: 'warning',
      proposalId: proposal.id,
      taskId: proposal.taskId,
    })
  }

  for (const task of tasks) {
    if (task.status !== 'review') continue
    pending.push({
      id: `review:${task.id}`,
      badge: '待验收',
      title: task.name,
      detail: projects.find((item) => item.id === task.projectId)?.name,
      tone: 'success',
      taskId: task.id,
    })
  }

  for (const approval of approvals) {
    if (approval.status === 'pending') continue
    const task = tasks.find((item) => item.id === approval.taskId)
    reviewed.push({
      id: approval.id,
      badge: approval.status === 'approved' ? '已允许' : '已拒绝',
      title: approval.title,
      detail: task?.name,
      tone: approval.status === 'approved' ? 'success' : 'soft',
      approvalId: approval.id,
      taskId: approval.taskId,
    })
  }

  for (const proposal of proposals) {
    if (proposal.status === 'pending') continue
    reviewed.push({
      id: proposal.id,
      badge: proposal.status === 'confirmed' ? '已允许' : '已拒绝',
      title: proposal.draftName ?? proposal.goal,
      tone: proposal.status === 'confirmed' ? 'success' : 'soft',
      proposalId: proposal.id,
      taskId: proposal.taskId,
    })
  }

  return { pending, reviewed }
}
