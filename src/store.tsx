import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'
import {
  EXTRA_FILE_CONTENTS,
  HOST_AGENT,
  HOST_ID,
  INITIAL_AGENTS,
  INITIAL_APPROVALS,
  INITIAL_DEVICES,
  INITIAL_DISCUSSIONS,
  INITIAL_EVENTS,
  INITIAL_FILES,
  INITIAL_HISTORY,
  INITIAL_HOSTS,
  INITIAL_MCP_SERVERS,
  INITIAL_MESSAGES,
  INITIAL_PREFS,
  INITIAL_PROJECTS,
  INITIAL_PROPOSALS,
  INITIAL_PRS,
  INITIAL_TASKS,
  initialProviderAccounts,
  PROVIDER_MODELS,
  QUOTA_PERCENT,
  REPO_TREES,
  SCAN_CATALOG,
  YOU_AGENT,
  YOU_ID,
} from './data'
import {
  closeTab as closeTabList,
  findDuplicate,
  isPlausiblePath,
  isValidName,
  isValidRepo,
  joinPath,
  normalizePath,
  nowIso,
  pathBasename,
  pendingApprovals,
  repoProjectName,
  sanitizeRepo,
  slugify,
  tabKey,
  uid,
  upsertTab,
} from './lib'
import type {
  Agent,
  Approval,
  ChannelType,
  ChatMessage,
  Device,
  Discussion,
  EntryMode,
  HistoryRecord,
  Preferences,
  Project,
  ProjectPane,
  ProjectSource,
  Proposal,
  McpServer,
  ProviderAccount,
  ProviderCheck,
  PullRequest,
  RemoteHost,
  RepoFile,
  RoomLayout,
  Tab,
  Task,
  TaskStatus,
  VoiceState,
  WorkflowEvent,
} from './types'
import { resolveSettingsSection } from './settings-sections'

export type NewProjectFields = {
  source: ProjectSource
  path: string
  repository: string
  name: string
  location: string
  entry: EntryMode
}

export type DialogState =
  | { type: 'new-project'; lockEntry?: boolean; topic?: string; fromPicker?: boolean }
  | { type: 'project-picker'; topic: string }
  | { type: 'approval'; approvalId: string }
  | { type: 'scheme'; approvalId: string }
  | { type: 'proposal'; proposalId: string }
  | { type: 'history'; recordId: string }
  | { type: 'new-agent' }
  | { type: 'edit-agent'; agentId: string }
  | { type: 'external-agent'; step: 1 | 2 | 3; hostId?: string; selected?: string[]; drafts?: Record<string, { name: string; description: string }> }
  | { type: 'remote-host' }
  | { type: 'confirm-delete-agent'; agentId: string }
  | { type: 'local-scan'; mode?: 'scan' | 'cite' }
  | null

export type BoardFocus = { projectId: string; column: TaskStatus; nonce: number }

export type WorkspaceState = {
  projects: Project[]
  tasks: Task[]
  agents: Agent[]
  approvals: Approval[]
  discussions: Discussion[]
  messages: ChatMessage[]
  events: WorkflowEvent[]
  proposals: Proposal[]
  history: HistoryRecord[]
  files: RepoFile[]
  prs: PullRequest[]
  devices: Device[]
  hosts: RemoteHost[]
  prefs: Preferences
  tabs: Tab[]
  activeTabKey: string | null
  relatedOpen: boolean
  projectPane: Record<string, ProjectPane>
  drafts: { host: string; tasks: Record<string, string>; discussions: Record<string, string> }
  voice: VoiceState | null
  toast: string | null
  dialog: DialogState
  roomLayout: RoomLayout
  settingsGroup: string
  selectedHostId: string | null
  inviteDiscussionId: string | null
  boardFocus: BoardFocus | null
  providerCheck: ProviderCheck
  providerDraft: { provider: string; model: string; apiKey: string; proxyUrl: string }
  providerAccounts: ProviderAccount[]
  mcpServers: McpServer[]
  mentionedScratch: string
  handheldMode: 'independent' | 'shared'
  handheldUser: string
}

export type Action =
  | { type: 'open-tab'; tab: Tab; expandRelated?: boolean; settingsGroup?: string; inviteDiscussionId?: string | null }
  | { type: 'close-tab'; key: string }
  | { type: 'select-tab'; key: string | null }
  | { type: 'set-related'; open: boolean }
  | { type: 'set-pane'; projectId: string; pane: ProjectPane }
  | { type: 'set-layout'; layout: RoomLayout }
  | { type: 'set-draft'; channelType: ChannelType; channelId: string; text: string }
  | { type: 'set-dialog'; dialog: DialogState }
  | { type: 'toast'; message: string | null }
  | { type: 'set-voice'; voice: VoiceState | null }
  | { type: 'board-focus'; focus: BoardFocus }
  | { type: 'send-message'; channelType: ChannelType; channelId: string; projectId?: string; text: string; authorId?: string; role?: ChatMessage['role'] }
  | { type: 'host-reply'; text: string }
  | { type: 'resolve-approval'; approvalId: string; decision: 'approved' | 'rejected'; optionId?: string }
  | { type: 'accept-delivery'; taskId: string; allow: boolean }
  | { type: 'resolve-proposal'; proposalId: string; decision: 'confirmed' | 'discarded' }
  | { type: 'add-proposal'; proposal: Proposal; note: string }
  | { type: 'create-project'; project: Project; entry: EntryMode; topic?: string }
  | { type: 'create-discussion'; discussion: Discussion; firstMessage?: string }
  | { type: 'mention'; discussionId: string; agentId: string }
  | { type: 'invite-agent'; discussionId: string; agentId: string }
  | { type: 'continue-history'; recordId: string; mode: 'continue' | 'reopen' }
  | { type: 'create-agent'; agent: Agent }
  | { type: 'update-agent'; agentId: string; patch: Partial<Agent> }
  | { type: 'pin-agent'; agentId: string; pinned: boolean }
  | { type: 'delete-agent'; agentId: string }
  | { type: 'add-host'; host: RemoteHost }
  | { type: 'select-host'; id: string | null }
  | { type: 'patch-host'; id: string; patch: Partial<RemoteHost> }
  | { type: 'set-prefs'; patch: Partial<Preferences> }
  | { type: 'set-settings-group'; group: string }
  | { type: 'set-provider-draft'; patch: Partial<WorkspaceState['providerDraft']> }
  | { type: 'set-provider-check'; check: ProviderCheck }
  | { type: 'patch-provider-account'; provider: string; patch: Partial<ProviderAccount> }
  | { type: 'add-mcp-server'; server: McpServer }
  | { type: 'patch-mcp-server'; id: string; patch: Partial<McpServer> }
  | { type: 'remove-mcp-server'; id: string }
  | { type: 'select-file'; tabKey: string; filePath: string }
  | { type: 'handheld-login'; name: string }
  | { type: 'handheld-logout' }
  | { type: 'set-handheld-mode'; mode: 'independent' | 'shared' }
  | { type: 'replace-state'; state: WorkspaceState }
  | { type: 'import-local-projects'; projects: Project[]; message?: string }
  | { type: 'finish-local-scan'; message?: string }

const ROOM_TAB: Tab = { key: 'room', kind: 'room', title: '项目室' }

const COL_WIDTHS_KEY = 'aha-desktop-flow-col-widths'
const LOCAL_SCAN_KEY = 'aha-desktop-flow-local-scan-done'

function readLocalScanDone(): boolean {
  try {
    return localStorage.getItem(LOCAL_SCAN_KEY) === '1'
  } catch {
    return false
  }
}

function persistLocalScanDone(done: boolean) {
  try {
    if (done) localStorage.setItem(LOCAL_SCAN_KEY, '1')
    else localStorage.removeItem(LOCAL_SCAN_KEY)
  } catch {
    /* private mode or quota */
  }
}

function readStoredColWidths(): Pick<Preferences, 'leftColWidth' | 'rightColWidth'> {
  try {
    const raw = localStorage.getItem(COL_WIDTHS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { leftColWidth?: unknown; rightColWidth?: unknown }
    const leftColWidth = typeof parsed.leftColWidth === 'number' && Number.isFinite(parsed.leftColWidth) ? Math.round(parsed.leftColWidth) : undefined
    const rightColWidth = typeof parsed.rightColWidth === 'number' && Number.isFinite(parsed.rightColWidth) ? Math.round(parsed.rightColWidth) : undefined
    return {
      ...(leftColWidth !== undefined ? { leftColWidth } : {}),
      ...(rightColWidth !== undefined ? { rightColWidth } : {}),
    }
  } catch {
    return {}
  }
}

function persistColWidths(prefs: Preferences) {
  try {
    const payload: { leftColWidth?: number; rightColWidth?: number } = {}
    if (typeof prefs.leftColWidth === 'number' && Number.isFinite(prefs.leftColWidth)) payload.leftColWidth = Math.round(prefs.leftColWidth)
    if (typeof prefs.rightColWidth === 'number' && Number.isFinite(prefs.rightColWidth)) payload.rightColWidth = Math.round(prefs.rightColWidth)
    if (Object.keys(payload).length === 0) localStorage.removeItem(COL_WIDTHS_KEY)
    else localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(payload))
  } catch {
    /* private mode or quota */
  }
}


const initialState: WorkspaceState = {
  projects: INITIAL_PROJECTS,
  tasks: INITIAL_TASKS,
  agents: INITIAL_AGENTS,
  approvals: INITIAL_APPROVALS,
  discussions: INITIAL_DISCUSSIONS,
  messages: INITIAL_MESSAGES,
  events: INITIAL_EVENTS,
  proposals: INITIAL_PROPOSALS,
  history: INITIAL_HISTORY,
  files: INITIAL_FILES,
  prs: INITIAL_PRS,
  devices: INITIAL_DEVICES,
  hosts: INITIAL_HOSTS,
  prefs: { ...INITIAL_PREFS, ...readStoredColWidths(), localScanDone: readLocalScanDone() },
  tabs: [],
  activeTabKey: null,
  relatedOpen: true,
  projectPane: {},
  drafts: { host: '', tasks: {}, discussions: {} },
  voice: null,
  toast: null,
  dialog: null,
  roomLayout: 'all',
  settingsGroup: 'backends',
  selectedHostId: 'device-studio',
  inviteDiscussionId: null,
  boardFocus: null,
  providerCheck: { provider: 'Anthropic', model: 'Claude Sonnet', status: 'idle' },
  providerDraft: { provider: 'Anthropic', model: 'Claude Sonnet', apiKey: '', proxyUrl: '' },
  providerAccounts: initialProviderAccounts(),
  mcpServers: INITIAL_MCP_SERVERS,
  mentionedScratch: '',
  handheldMode: 'independent',
  handheldUser: '',
}

function appendReceipt(state: WorkspaceState, projectId: string, _taskId: string, text: string): ChatMessage[] {
  const discussion = state.discussions.find((item) => item.projectId === projectId && !item.taskId)
  if (!discussion) return state.messages
  return [
    ...state.messages,
    {
      id: uid('msg'),
      channelType: 'discussion',
      channelId: discussion.id,
      projectId,
      authorId: HOST_ID,
      role: 'host',
      text,
      createdAt: nowIso(),
    },
  ]
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'open-tab': {
      const tabs = upsertTab(state.tabs, action.tab)
      const relatedOpen = action.expandRelated ? true : state.relatedOpen
      const leftVoice =
        state.voice &&
        ((state.voice.origin.channelType === 'discussion' && action.tab.kind !== 'discussion') ||
          (state.voice.origin.channelType === 'task' && action.tab.kind !== 'task') ||
          (state.voice.origin.channelType === 'host' && action.tab.kind !== 'host' && state.voice.target === 'composer'))
          ? null
          : state.voice
      // Cancel unsent voice if leaving the bound tab
      const leavingBound =
        state.voice &&
        state.activeTabKey &&
        state.activeTabKey !== action.tab.key &&
        voiceBoundTab(state.voice) === state.activeTabKey &&
        voiceBoundTab(state.voice) !== action.tab.key
      return {
        ...state,
        tabs,
        activeTabKey: action.tab.key,
        relatedOpen,
        settingsGroup: action.settingsGroup ? resolveSettingsSection(action.settingsGroup) : state.settingsGroup,
        inviteDiscussionId:
          action.inviteDiscussionId === undefined ? state.inviteDiscussionId : action.inviteDiscussionId,
        voice: leavingBound || leftVoice === null ? (leavingBound ? null : leftVoice) : state.voice,
      }
    }
    case 'close-tab': {
      const wasBound = state.voice && voiceBoundTab(state.voice) === action.key
      const { tabs, nextKey } = closeTabList(state.tabs, action.key)
      return { ...state, tabs, activeTabKey: nextKey, voice: wasBound ? null : state.voice }
    }
    case 'select-tab': {
      const leavingBound =
        state.voice && voiceBoundTab(state.voice) === state.activeTabKey && state.activeTabKey !== action.key
      return { ...state, activeTabKey: action.key, voice: leavingBound ? null : state.voice }
    }
    case 'set-related':
      return { ...state, relatedOpen: action.open }
    case 'set-pane':
      return { ...state, projectPane: { ...state.projectPane, [action.projectId]: action.pane } }
    case 'set-layout':
      return { ...state, roomLayout: action.layout }
    case 'set-draft': {
      if (action.channelType === 'host') return { ...state, drafts: { ...state.drafts, host: action.text } }
      if (action.channelType === 'task') {
        return { ...state, drafts: { ...state.drafts, tasks: { ...state.drafts.tasks, [action.channelId]: action.text } } }
      }
      return {
        ...state,
        drafts: { ...state.drafts, discussions: { ...state.drafts.discussions, [action.channelId]: action.text } },
      }
    }
    case 'set-dialog':
      return { ...state, dialog: action.dialog }
    case 'toast':
      return { ...state, toast: action.message }
    case 'set-voice':
      return { ...state, voice: action.voice }
    case 'board-focus':
      return { ...state, boardFocus: action.focus }
    case 'send-message': {
      const message: ChatMessage = {
        id: uid('msg'),
        channelType: action.channelType,
        channelId: action.channelId,
        projectId: action.projectId,
        authorId: action.authorId ?? YOU_ID,
        role: action.role ?? 'you',
        text: action.text,
        createdAt: nowIso(),
      }
      const drafts = { ...state.drafts }
      if (action.channelType === 'host' && message.authorId === YOU_ID) drafts.host = ''
      if (action.channelType === 'task' && message.authorId === YOU_ID) {
        drafts.tasks = { ...drafts.tasks, [action.channelId]: '' }
      }
      if (action.channelType === 'discussion' && message.authorId === YOU_ID) {
        drafts.discussions = { ...drafts.discussions, [action.channelId]: '' }
      }
      const events =
        action.channelType === 'task' && message.authorId === YOU_ID
          ? [
              ...state.events,
              {
                id: uid('ev'),
                taskId: action.channelId,
                type: 'chat' as const,
                actorId: YOU_ID,
                text: action.text,
                occurredAt: nowIso(),
              },
            ]
          : state.events
      return { ...state, messages: [...state.messages, message], drafts, events, voice: null }
    }
    case 'host-reply':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: uid('msg'),
            channelType: 'host',
            channelId: 'host',
            authorId: HOST_ID,
            role: 'host',
            text: action.text,
            createdAt: nowIso(),
          },
        ],
      }
    case 'resolve-approval': {
      const approval = state.approvals.find((item) => item.id === action.approvalId)
      if (!approval || approval.status !== 'pending') {
        return { ...state, toast: '这条请求已经处理过了。', dialog: null }
      }
      if (approval.options && action.decision === 'approved' && !action.optionId) {
        return { ...state, dialog: { type: 'scheme', approvalId: approval.id } }
      }
      const option = approval.options?.find((item) => item.id === action.optionId)
      const tasks = state.tasks.map((task) => {
        if (task.id !== approval.taskId) return task
        if (action.decision === 'approved' && approval.nextStatus) {
          return {
            ...task,
            status: approval.nextStatus,
            latestUpdate: option ? `已选择「${option.label}」。` : '已允许该请求。',
          }
        }
        return {
          ...task,
          latestUpdate: action.decision === 'approved' ? (option ? `已选择「${option.label}」。` : '已允许该请求。') : '已拒绝该请求。',
        }
      })
      const approvals = state.approvals.map((item) =>
        item.id === approval.id
          ? { ...item, status: action.decision, decision: action.optionId ?? action.decision }
          : item,
      )
      const task = tasks.find((item) => item.id === approval.taskId)!
      const resultText =
        action.decision === 'approved'
          ? option
            ? `已选择「${option.label}」。`
            : `已允许「${approval.title}」。`
          : `已拒绝「${approval.title}」。`
      const events: WorkflowEvent[] = [
        ...state.events,
        {
          id: uid('ev'),
          taskId: task.id,
          type: 'approval',
          actorId: YOU_ID,
          text: resultText,
          occurredAt: nowIso(),
          approvalId: approval.id,
        },
      ]
      const messages = appendReceipt(state, task.projectId, task.id, `${task.name}：${resultText}`)
      return {
        ...state,
        tasks,
        approvals,
        events,
        messages,
        dialog: null,
        toast: resultText,
      }
    }
    case 'accept-delivery': {
      const task = state.tasks.find((item) => item.id === action.taskId)
      if (!task || task.status !== 'review') return state
      const nextStatus: TaskStatus = action.allow ? 'done' : 'doing'
      const resultText = action.allow ? '已通过验收，任务完成。' : '已拒绝验收，任务回到进行中。'
      const tasks = state.tasks.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus, latestUpdate: resultText } : item,
      )
      const events: WorkflowEvent[] = [
        ...state.events,
        {
          id: uid('ev'),
          taskId: task.id,
          type: 'acceptance',
          actorId: YOU_ID,
          text: resultText,
          occurredAt: nowIso(),
        },
      ]
      const messages = appendReceipt(state, task.projectId, task.id, `${task.name}：${resultText}`)
      return { ...state, tasks, events, messages, dialog: null, toast: resultText }
    }

    case 'add-proposal': {
      const exists = state.proposals.some((item) => item.discussionId === action.proposal.discussionId && item.status === 'pending')
      if (exists) return { ...state, toast: '请先处理当前这条待确认提议。' }
      const messages: ChatMessage[] = [
        ...state.messages,
        {
          id: uid('msg'),
          channelType: 'discussion',
          channelId: action.proposal.discussionId,
          projectId: action.proposal.projectId,
          authorId: HOST_ID,
          role: 'host',
          text: action.note,
          createdAt: nowIso(),
          proposalId: action.proposal.id,
        },
      ]
      return { ...state, proposals: [...state.proposals, action.proposal], messages }
    }
    case 'resolve-proposal': {
      const proposal = state.proposals.find((item) => item.id === action.proposalId)
      if (!proposal) return state
      if (proposal.status !== 'pending') {
        return { ...state, toast: '这条提议已经处理过了。', dialog: null }
      }
      if (action.decision === 'discarded') {
        const proposals = state.proposals.map((item) =>
          item.id === proposal.id ? { ...item, status: 'discarded' as const } : item,
        )
        const text = `已拒绝提议「${proposal.draftName ?? proposal.goal}」。任务保持原状。`
        const messages: ChatMessage[] = [
          ...state.messages,
          {
            id: uid('msg'),
            channelType: 'discussion',
            channelId: proposal.discussionId,
            projectId: proposal.projectId,
            authorId: HOST_ID,
            role: 'host',
            text,
            createdAt: nowIso(),
          },
        ]
        return { ...state, proposals, messages, dialog: null, toast: '已拒绝提议。' }
      }
      let tasks = state.tasks
      let taskId = proposal.taskId
      let outcomeType: 'created' | 'modified' = 'modified'
      if (proposal.newTask || !proposal.taskId) {
        taskId = uid('task')
        outcomeType = 'created'
        const created: Task = {
          id: taskId,
          projectId: proposal.projectId,
          name: proposal.draftName ?? proposal.goal.slice(0, 24),
          ownerAgentId: proposal.ownerAgentId,
          goal: proposal.goal,
          latestUpdate: '已根据讨论提议派发，进入进行中。',
          status: 'doing',
          repositoryId: state.projects.find((item) => item.id === proposal.projectId)?.repository,
        }
        tasks = [...tasks, created]
      } else {
        tasks = tasks.map((task) =>
          task.id === proposal.taskId
            ? { ...task, goal: proposal.goal, latestUpdate: '已根据讨论更新目标。' }
            : task,
        )
      }
      const proposals = state.proposals.map((item) =>
        item.id === proposal.id ? { ...item, status: 'confirmed' as const, taskId } : item,
      )
      const discussions = state.discussions.map((item) =>
        item.id === proposal.discussionId
          ? {
              ...item,
              relatedTaskIds: item.relatedTaskIds.includes(taskId!)
                ? item.relatedTaskIds
                : [...item.relatedTaskIds, taskId!],
            }
          : item,
      )
      const task = tasks.find((item) => item.id === taskId)!
      const text =
        outcomeType === 'created'
          ? `已允许提议，并派发任务「${task.name}」。负责人是${agentName(state, task.ownerAgentId)}。`
          : `已允许提议，并更新任务「${task.name}」的目标。`
      const messages: ChatMessage[] = [
        ...state.messages,
        {
          id: uid('msg'),
          channelType: 'discussion',
          channelId: proposal.discussionId,
          projectId: proposal.projectId,
          authorId: HOST_ID,
          role: 'host',
          text,
          createdAt: nowIso(),
        },
      ]
      const events: WorkflowEvent[] = [
        ...state.events,
        {
          id: uid('ev'),
          taskId: task.id,
          type: 'assign',
          actorId: HOST_ID,
          recipientId: task.ownerAgentId,
          text,
          occurredAt: nowIso(),
        },
      ]
      const history = state.history.map((record) =>
        record.liveDiscussionId === proposal.discussionId
          ? {
              ...record,
              relatedTaskIds: record.relatedTaskIds.includes(task.id)
                ? record.relatedTaskIds
                : [...record.relatedTaskIds, task.id],
              outcomes: [
                ...record.outcomes,
                {
                  type: outcomeType,
                  sourceDraftId: proposal.id,
                  taskId: task.id,
                  title: task.name,
                  goal: proposal.goal,
                  owner: agentName(state, task.ownerAgentId),
                  acceptance: proposal.acceptance,
                },
              ],
            }
          : record,
      )
      return { ...state, tasks, proposals, discussions, messages, events, history, dialog: null, toast: text }
    }
    case 'create-project': {
      const projects = [...state.projects, action.project]
      if (action.entry === 'cli') {
        const tab = { key: tabKey('cli', action.project.id), kind: 'cli' as const, title: `${action.project.name} CLI`, projectId: action.project.id }
        return { ...state, projects, dialog: null, tabs: upsertTab(state.tabs, tab), activeTabKey: tab.key, relatedOpen: true }
      }
      const discussion: Discussion = {
        id: uid('disc'),
        projectId: action.project.id,
        title: action.topic || `${action.project.name}讨论`,
        goal: action.topic || '',
        startedAt: nowIso(),
        participantIds: [YOU_ID, HOST_ID],
        relatedTaskIds: [],
        invitedIds: [],
        mentionedIds: [],
      }
      const messages: ChatMessage[] = action.topic
        ? [
            ...state.messages,
            {
              id: uid('msg'),
              channelType: 'discussion',
              channelId: discussion.id,
              projectId: action.project.id,
              authorId: YOU_ID,
              role: 'you',
              text: action.topic,
              createdAt: nowIso(),
            },
            {
              id: uid('msg'),
              channelType: 'discussion',
              channelId: discussion.id,
              projectId: action.project.id,
              authorId: HOST_ID,
              role: 'host',
              text: `好，我们在「${action.project.name}」里继续谈这件事。`,
              createdAt: nowIso(),
            },
          ]
        : [
            ...state.messages,
            {
              id: uid('msg'),
              channelType: 'discussion',
              channelId: discussion.id,
              projectId: action.project.id,
              authorId: HOST_ID,
              role: 'host',
              text: `「${action.project.name}」已创建。你可以从这里开始讨论。`,
              createdAt: nowIso(),
            },
          ]
      const tab = { key: tabKey('discussion', discussion.id), kind: 'discussion' as const, title: discussion.title, projectId: action.project.id, entityId: discussion.id }
      return {
        ...state,
        projects,
        discussions: [...state.discussions, discussion],
        messages,
        dialog: null,
        tabs: upsertTab(state.tabs, tab),
        activeTabKey: tab.key,
        relatedOpen: true,
      }
    }
    case 'create-discussion': {
      const discussions = [...state.discussions, action.discussion]
      const messages = action.firstMessage
        ? [
            ...state.messages,
            {
              id: uid('msg'),
              channelType: 'discussion' as const,
              channelId: action.discussion.id,
              projectId: action.discussion.projectId,
              authorId: YOU_ID,
              role: 'you' as const,
              text: action.firstMessage,
              createdAt: nowIso(),
            },
            {
              id: uid('msg'),
              channelType: 'discussion' as const,
              channelId: action.discussion.id,
              projectId: action.discussion.projectId,
              authorId: HOST_ID,
              role: 'host' as const,
              text: `好，我们在「${state.projects.find((item) => item.id === action.discussion.projectId)?.name ?? '项目'}」里继续谈这件事。`,
              createdAt: nowIso(),
            },
          ]
        : state.messages
      return { ...state, discussions, messages }
    }
    case 'mention': {
      const discussions = state.discussions.map((item) =>
        item.id === action.discussionId && !item.mentionedIds.includes(action.agentId)
          ? { ...item, mentionedIds: [...item.mentionedIds, action.agentId] }
          : item,
      )
      const discussion = discussions.find((item) => item.id === action.discussionId)
      const agent = findAgent(state, action.agentId)
      if (!discussion || !agent) return { ...state, discussions }
      if (state.messages.some((message) => message.channelId === discussion.id && message.authorId === agent.id && message.role === 'agent')) {
        return { ...state, discussions }
      }
      const messages: ChatMessage[] = [
        ...state.messages,
        {
          id: uid('msg'),
          channelType: 'discussion',
          channelId: discussion.id,
          projectId: discussion.projectId,
          authorId: agent.id,
          role: 'agent',
          text: `${agent.name}已听到点名。我会按当前讨论目标补充看法。`,
          createdAt: nowIso(),
        },
      ]
      return { ...state, discussions, messages }
    }
    case 'invite-agent': {
      const discussions = state.discussions.map((item) => {
        if (item.id !== action.discussionId) return item
        const participantIds = item.participantIds.includes(action.agentId)
          ? item.participantIds
          : [...item.participantIds, action.agentId]
        const invitedIds = item.invitedIds.includes(action.agentId) ? item.invitedIds : [...item.invitedIds, action.agentId]
        return { ...item, participantIds, invitedIds }
      })
      return { ...state, discussions, toast: '已加入讨论。点名后才会发言。' }
    }
    case 'continue-history': {
      const record = state.history.find((item) => item.id === action.recordId)
      if (!record) return state
      if (action.mode === 'continue' && record.liveDiscussionId) {
        return { ...state, dialog: null }
      }
      if (record.continuationId) {
        return { ...state, dialog: null }
      }
      const discussionId = uid('disc')
      const discussion: Discussion = {
        id: discussionId,
        projectId: record.projectId,
        title: record.title,
        goal: record.goal,
        startedAt: nowIso(),
        participantIds: record.participants.map((item) => item.id),
        relatedTaskIds: record.relatedTaskIds,
        previousRecordId: record.id,
        invitedIds: [],
        mentionedIds: record.participants.filter((item) => item.id !== YOU_ID && item.id !== HOST_ID).map((item) => item.id),
      }
      const lead = record.conclusion
        ? `这是从「${record.title}」接续的讨论。上次的结论是：${record.conclusion}`
        : `我们从「${record.title}」继续。`
      const messages: ChatMessage[] = [
        ...state.messages,
        {
          id: uid('msg'),
          channelType: 'discussion',
          channelId: discussionId,
          projectId: record.projectId,
          authorId: HOST_ID,
          role: 'host',
          text: lead,
          createdAt: nowIso(),
        },
      ]
      const history = state.history.map((item) =>
        item.id === record.id ? { ...item, continuationId: discussionId } : item,
      )
      const tab = { key: tabKey('discussion', discussionId), kind: 'discussion' as const, title: discussion.title, projectId: record.projectId, entityId: discussionId }
      return {
        ...state,
        discussions: [...state.discussions, discussion],
        messages,
        history,
        dialog: null,
        tabs: upsertTab(state.tabs, tab),
        activeTabKey: tab.key,
      }
    }
    case 'create-agent':
      return { ...state, agents: [...state.agents, action.agent], dialog: null, toast: `已创建助理「${action.agent.name}」。` }
    case 'update-agent':
      return {
        ...state,
        agents: state.agents.map((agent) => (agent.id === action.agentId ? { ...agent, ...action.patch } : agent)),
        dialog: null,
        toast: '已保存助理资料。',
      }
    case 'pin-agent':
      return {
        ...state,
        agents: state.agents.map((agent) => (agent.id === action.agentId ? { ...agent, pinned: action.pinned } : agent)),
      }
    case 'delete-agent':
      return {
        ...state,
        agents: state.agents.filter((agent) => agent.id !== action.agentId),
        dialog: null,
        toast: '已删除助理。历史和任务记录仍保留。',
      }
    case 'add-host':
      return {
        ...state,
        hosts: [...state.hosts, action.host],
        devices: [
          ...state.devices,
          {
            id: action.host.id,
            name: action.host.name,
            connectionState: 'simulated',
            hostAddress: action.host.hostAddress,
          },
        ],
        selectedHostId: action.host.id,
        dialog: null,
        toast: `${action.host.name} 已连接 · 模拟`,
      }
    case 'select-host':
      return { ...state, selectedHostId: action.id }
    case 'patch-host':
      return {
        ...state,
        hosts: state.hosts.map((host) => (host.id === action.id ? { ...host, ...action.patch } : host)),
        devices: state.devices.map((device) =>
          device.id === action.id
            ? {
                ...device,
                name: action.patch.name ?? device.name,
                hostAddress: action.patch.hostAddress ?? device.hostAddress,
                connectionState: action.patch.connectionState ?? device.connectionState,
              }
            : device,
        ),
        toast: action.patch.connectionState === 'online' || action.patch.connectionState === 'simulated'
          ? `${state.hosts.find((host) => host.id === action.id)?.name ?? '主机'} 已重新连接`
          : state.toast,
      }
    case 'import-local-projects': {
      const existing = new Set(state.projects.map((item) => normalizePath(item.path)))
      const added = action.projects.filter((item) => !existing.has(normalizePath(item.path)))
      const toast = action.message ?? (added.length ? `已引入 ${added.length} 个项目到项目室。` : '这些路径已经在项目室里。')
      return {
        ...state,
        projects: [...state.projects, ...added],
        prefs: { ...state.prefs, localScanDone: true },
        dialog: null,
        toast,
      }
    }
    case 'finish-local-scan':
      return {
        ...state,
        prefs: { ...state.prefs, localScanDone: true },
        dialog: null,
        toast: action.message ?? null,
      }
    case 'set-prefs':
      return { ...state, prefs: { ...state.prefs, ...action.patch } }
    case 'set-settings-group':
      return { ...state, settingsGroup: resolveSettingsSection(action.group) }
    case 'set-provider-draft': {
      const providerDraft = { ...state.providerDraft, ...action.patch }
      const providerCheck =
        action.patch.provider || action.patch.model || action.patch.apiKey !== undefined || action.patch.proxyUrl !== undefined
          ? { ...state.providerCheck, status: 'idle' as const, message: undefined, provider: providerDraft.provider, model: providerDraft.model }
          : state.providerCheck
      return { ...state, providerDraft, providerCheck }
    }
    case 'set-provider-check':
      return { ...state, providerCheck: action.check }
    case 'patch-provider-account': {
      const providerAccounts = state.providerAccounts.map((item) =>
        item.provider === action.provider ? { ...item, ...action.patch } : item,
      )
      const current = providerAccounts.find((item) => item.provider === action.provider)
      const providerDraft = current
        ? { provider: current.provider, model: current.model, apiKey: current.apiKey, proxyUrl: current.proxyUrl }
        : state.providerDraft
      return { ...state, providerAccounts, providerDraft }
    }
    case 'add-mcp-server':
      return { ...state, mcpServers: [...state.mcpServers, action.server] }
    case 'patch-mcp-server':
      return {
        ...state,
        mcpServers: state.mcpServers.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item)),
      }
    case 'remove-mcp-server':
      return { ...state, mcpServers: state.mcpServers.filter((item) => item.id !== action.id) }
    case 'select-file': {
      const tabs = state.tabs.map((tab) => (tab.key === action.tabKey ? { ...tab, filePath: action.filePath } : tab))
      return { ...state, tabs }
    }
    case 'handheld-login':
      return { ...state, handheldUser: action.name }
    case 'handheld-logout':
      return { ...state, handheldUser: '', handheldMode: 'independent' }
    case 'set-handheld-mode':
      return { ...state, handheldMode: action.mode }
    case 'replace-state':
      return action.state
    default:
      return state
  }
}

function voiceBoundTab(voice: VoiceState) {
  if (voice.origin.channelType === 'host') return 'host'
  if (voice.origin.channelType === 'discussion') return tabKey('discussion', voice.origin.channelId)
  return tabKey('task', voice.origin.channelId)
}

function findAgent(state: WorkspaceState, id: string) {
  if (id === YOU_ID) return YOU_AGENT
  if (id === HOST_ID) return HOST_AGENT
  return state.agents.find((agent) => agent.id === id)
}

function agentName(state: WorkspaceState, id: string) {
  return findAgent(state, id)?.name ?? '未指定'
}

type Api = {
  state: WorkspaceState
  dispatch: Dispatch<Action>
  agent: (id: string) => Agent | undefined
  agentName: (id: string) => string
  project: (id?: string) => Project | undefined
  task: (id?: string) => Task | undefined
  activeTab: Tab | undefined
  scope: { type: 'global' | 'project' | 'task'; projectId?: string; taskId?: string }
  pendingOf: (projectId?: string) => Approval[]
  openRoom: () => void
  openHost: () => void
  openHistory: () => void
  openSettings: (group?: string, inviteDiscussionId?: string | null) => void
  openBoard: (projectId: string, column?: TaskStatus) => void
  openCli: (projectId: string) => void
  openTask: (taskId: string) => void
  openDiscussion: (discussionId: string) => void
  openOrStartProjectDiscussion: (projectId: string, opts?: { taskId?: string; topic?: string }) => void
  openTaskFiles: (taskId: string, filePath?: string) => void
  openRepoFile: (projectId: string, repositoryId: string, path: string) => void
  openPr: (taskId: string, filePath?: string) => void
  closeTab: (key: string) => void
  startVoice: (origin: VoiceState['origin'], target: VoiceState['target']) => void
  sendText: (channelType: ChannelType, channelId: string, text: string, projectId?: string) => void
  postHostProgress: (projectId?: string) => string
  fileContent: (repositoryId: string, path: string) => string | undefined
}

const WorkspaceContext = createContext<Api | null>(null)

const LINK_CHANNEL = 'ahastation-desktop-flow'

export function isHandheldView(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'handheld'
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const handheld = isHandheldView()
  const [state, reduceDispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const skipBroadcast = useRef(false)
  stateRef.current = state

  const dispatch = useCallback<Dispatch<Action>>((action) => {
    if (handheld && action.type !== 'replace-state') {
      channelRef.current?.postMessage({ type: 'action', action })
    }
    reduceDispatch(action)
  }, [handheld])

  useEffect(() => {
    const channel = new BroadcastChannel(LINK_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; state?: WorkspaceState; action?: Action } | null
      if (!data) return
      if (data.type === 'hello' && !handheld) {
        channel.postMessage({ type: 'state', state: stateRef.current })
      }
      if (data.type === 'state' && handheld && data.state) {
        skipBroadcast.current = true
        reduceDispatch({ type: 'replace-state', state: data.state })
      }
      if (data.type === 'action' && !handheld && data.action) {
        reduceDispatch(data.action)
      }
    }
    if (handheld) channel.postMessage({ type: 'hello' })
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [handheld])

  useEffect(() => {
    if (handheld) return
    if (skipBroadcast.current) {
      skipBroadcast.current = false
      return
    }
    channelRef.current?.postMessage({ type: 'state', state })
  }, [state, handheld])

  useEffect(() => {
    if (!state.toast) return
    const timer = window.setTimeout(() => reduceDispatch({ type: 'toast', message: null }), 3200)
    return () => window.clearTimeout(timer)
  }, [state.toast])

  useEffect(() => {
    persistColWidths(state.prefs)
  }, [state.prefs.leftColWidth, state.prefs.rightColWidth])

  useEffect(() => {
    persistLocalScanDone(state.prefs.localScanDone)
  }, [state.prefs.localScanDone])

  const agent = useCallback((id: string) => findAgent(state, id), [state])
  const nameOf = useCallback((id: string) => agentName(state, id), [state])
  const project = useCallback((id?: string) => state.projects.find((item) => item.id === id), [state.projects])
  const taskOf = useCallback((id?: string) => state.tasks.find((item) => item.id === id), [state.tasks])

  const activeTab = state.tabs.find((tab) => tab.key === state.activeTabKey)

  const scope = useMemo(() => {
    const tab = activeTab
    if (!tab) return { type: 'global' as const }
    if (tab.kind === 'task' || tab.kind === 'task-file' || tab.kind === 'pr-diff') {
      const task = state.tasks.find((item) => item.id === tab.entityId)
      return { type: 'task' as const, projectId: task?.projectId ?? tab.projectId, taskId: tab.entityId }
    }
    if (tab.kind === 'board' || tab.kind === 'cli' || tab.kind === 'discussion' || tab.kind === 'repo-file') {
      return { type: 'project' as const, projectId: tab.projectId }
    }
    return { type: 'global' as const }
  }, [activeTab, state.tasks])

  const pendingOf = useCallback(
    (projectId?: string) => pendingApprovals(state.approvals, state.tasks, projectId),
    [state.approvals, state.tasks],
  )

  const openTab = useCallback(
    (tab: Tab, opts?: { expandRelated?: boolean; settingsGroup?: string; inviteDiscussionId?: string | null }) => {
      dispatch({
        type: 'open-tab',
        tab,
        expandRelated: opts?.expandRelated,
        settingsGroup: opts?.settingsGroup,
        inviteDiscussionId: opts?.inviteDiscussionId,
      })
    },
    [],
  )

  const openRoom = useCallback(() => openTab(ROOM_TAB), [openTab])
  const openHost = useCallback(() => openTab({ key: 'host', kind: 'host', title: 'Aha Host' }), [openTab])
  const openHistory = useCallback(() => openTab({ key: 'history', kind: 'history', title: '历史讨论' }), [openTab])
  const openSettings = useCallback(
    (group?: string, inviteDiscussionId?: string | null) =>
      openTab(
        { key: 'settings', kind: 'settings', title: '设置' },
        { settingsGroup: group ?? (inviteDiscussionId ? 'backends' : undefined), inviteDiscussionId },
      ),
    [openTab],
  )
  const openBoard = useCallback(
    (projectId: string, column?: TaskStatus) => {
      const item = project(projectId)
      openTab({ key: tabKey('board', projectId), kind: 'board', title: item?.name ?? '任务面板', projectId })
      if (column) dispatch({ type: 'board-focus', focus: { projectId, column, nonce: Date.now() } })
    },
    [openTab, project],
  )
  const openCli = useCallback(
    (projectId: string) => {
      const item = project(projectId)
      openTab({ key: tabKey('cli', projectId), kind: 'cli', title: `${item?.name ?? '项目'} CLI`, projectId })
    },
    [openTab, project],
  )
  const openTask = useCallback(
    (taskId: string) => {
      const item = taskOf(taskId)
      if (!item) return
      openTab(
        { key: tabKey('task', taskId), kind: 'task', title: item.name, projectId: item.projectId, entityId: taskId },
        { expandRelated: true },
      )
    },
    [openTab, taskOf],
  )
  const openDiscussion = useCallback(
    (discussionId: string) => {
      const item = state.discussions.find((row) => row.id === discussionId)
      if (!item) return
      openTab({
        key: tabKey('discussion', discussionId),
        kind: 'discussion',
        title: item.title,
        projectId: item.projectId,
        entityId: discussionId,
      })
    },
    [openTab, state.discussions],
  )

  const openOrStartProjectDiscussion = useCallback(
    (projectId: string, opts?: { taskId?: string; topic?: string }) => {
      const existing = opts?.taskId
        ? state.discussions.find((item) => item.projectId === projectId && item.taskId === opts.taskId)
        : state.discussions.find((item) => item.projectId === projectId && !item.taskId)
      if (existing) {
        openDiscussion(existing.id)
        return
      }
      const projectItem = project(projectId)
      const taskItem = opts?.taskId ? taskOf(opts.taskId) : undefined
      const discussion: Discussion = {
        id: uid('disc'),
        projectId,
        taskId: opts?.taskId,
        title: opts?.topic || (taskItem ? `讨论「${taskItem.name}」` : `${projectItem?.name ?? '项目'}讨论`),
        goal: taskItem?.goal || opts?.topic || '',
        startedAt: nowIso(),
        participantIds: [
          YOU_ID,
          HOST_ID,
          ...state.tasks
            .filter((row) => row.projectId === projectId && (row.status === 'doing' || row.id === opts?.taskId))
            .map((row) => row.ownerAgentId),
        ].filter((id, index, list) => list.indexOf(id) === index),
        relatedTaskIds: opts?.taskId ? [opts.taskId] : [],
        invitedIds: [],
        mentionedIds: [],
      }
      dispatch({ type: 'create-discussion', discussion, firstMessage: opts?.topic })
      openTab({
        key: tabKey('discussion', discussion.id),
        kind: 'discussion',
        title: discussion.title,
        projectId,
        entityId: discussion.id,
      })
    },
    [openDiscussion, openTab, project, state.discussions, state.tasks, taskOf],
  )

  const openTaskFiles = useCallback(
    (taskId: string, filePath?: string) => {
      const item = taskOf(taskId)
      if (!item) return
      openTab(
        {
          key: tabKey('task-file', taskId),
          kind: 'task-file',
          title: filePath ? pathBasename(filePath) : `${item.name}文件`,
          projectId: item.projectId,
          entityId: taskId,
          filePath,
        },
        { expandRelated: true },
      )
    },
    [openTab, taskOf],
  )

  const openRepoFile = useCallback(
    (projectId: string, repositoryId: string, path: string) => {
      openTab({
        key: tabKey('repo-file', projectId, `${repositoryId}:${path}`),
        kind: 'repo-file',
        title: pathBasename(path),
        projectId,
        entityId: repositoryId,
        filePath: path,
      })
    },
    [openTab],
  )

  const openPr = useCallback(
    (taskId: string, filePath?: string) => {
      const pr = state.prs.find((item) => item.taskId === taskId)
      const item = taskOf(taskId)
      if (!pr || !item) return
      const preferred =
        filePath && pr.files.some((file) => file.path === filePath) ? filePath : pr.files[0]?.path
      openTab(
        {
          key: tabKey('pr-diff', taskId),
          kind: 'pr-diff',
          title: `PR #${pr.number}`,
          projectId: item.projectId,
          entityId: taskId,
          filePath: preferred,
        },
        { expandRelated: true },
      )
    },
    [openTab, state.prs, taskOf],
  )

  const closeTab = useCallback((key: string) => dispatch({ type: 'close-tab', key }), [])

  const startVoice = useCallback((origin: VoiceState['origin'], target: VoiceState['target']) => {
    dispatch({ type: 'set-voice', voice: { phase: 'listening', origin, target, transcript: '' } })
  }, [])

  const postHostProgress = useCallback(
    (projectId?: string) => {
      const list = projectId ? state.projects.filter((item) => item.id === projectId) : state.projects
      const parts: string[] = []
      for (const item of list) {
        const pending = pendingApprovals(state.approvals, state.tasks, item.id)
        const review = state.tasks.filter((task) => task.projectId === item.id && task.status === 'review')
        const doing = state.tasks.filter((task) => task.projectId === item.id && task.status === 'doing')
        if (pending.length) {
          parts.push(
            `${item.name}有 ${pending.length} 条待审批，优先处理「${pending[0].title}」。`,
          )
        } else if (review.length) {
          parts.push(`${item.name}有 ${review.length} 项待验收，最近是「${review[0].name}」。`)
        } else if (doing.length) {
          parts.push(`${item.name}正在进行「${doing[0].name}」。`)
        } else {
          parts.push(`${item.name}暂时没有待办。`)
        }
      }
      return parts.join(' ') || '目前没有可见的项目进展。'
    },
    [state.approvals, state.projects, state.tasks],
  )

  const sendText = useCallback(
    (channelType: ChannelType, channelId: string, text: string, projectId?: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      dispatch({ type: 'send-message', channelType, channelId, projectId, text: trimmed })
      if (channelType === 'host') {
        if (/^\/帮助/.test(trimmed)) {
          window.setTimeout(() => {
            dispatch({
              type: 'host-reply',
              text: '可以用 @ 点名智能体，# 引用项目或任务，/进展 汇总工作，/讨论 发起讨论，也可以点回形针附上文件。',
            })
          }, 400)
          return
        }
        const wantsDiscussion = /发起讨论|开始讨论|开个讨论|讨论一下|^\/讨论/.test(trimmed)
        const wantsProgress = /进展|怎么样|卡在|进度|现在怎样|汇总|^\/进展/.test(trimmed)
        window.setTimeout(() => {
          if (wantsDiscussion) {
            dispatch({
              type: 'host-reply',
              text: '可以。若目标项目已经明确，我会带你进入该项目讨论；如果还不能确定，请先选择一个项目。',
            })
            dispatch({ type: 'set-dialog', dialog: { type: 'project-picker', topic: trimmed } })
            return
          }
          const named = state.projects.find(
            (item) => trimmed.includes(item.name) || item.aliases?.some((alias) => trimmed.includes(alias)),
          )
          dispatch({ type: 'host-reply', text: postHostProgress(named?.id) })
        }, wantsProgress || wantsDiscussion ? 500 : 600)
        if (!wantsDiscussion && !wantsProgress) {
          // still reply with a short acknowledgement plus progress if it looks like a question
          return
        }
      }
      if (channelType === 'discussion' && channelId.startsWith('hh-agent-')) {
        const agentId = channelId.slice('hh-agent-'.length)
        const mateName = nameOf(agentId)
        const owned = state.tasks.filter((task) => task.ownerAgentId === agentId && task.status !== 'done')
        const pendingAsk = state.approvals.filter(
          (item) => item.status === 'pending' && owned.some((task) => task.id === item.taskId),
        )
        const review = owned.filter((task) => task.status === 'review')
        const doing = owned.filter((task) => task.status === 'doing')
        const focus = pendingAsk[0]?.title ?? review[0]?.name ?? doing[0]?.name ?? owned[0]?.name
        const note = pendingAsk[0]?.detail ?? review[0]?.latestUpdate ?? doing[0]?.latestUpdate ?? ''
        const wantsProgress = /进展|怎么样|卡在|进度|现在怎样|汇总|^\/进展/.test(trimmed)
        window.setTimeout(() => {
          const reply = wantsProgress
            ? focus
              ? `我这边「${focus}」还在推进。${note}`.trim()
              : '我这边目前没有卡住的任务，有新安排可以直接说。'
            : focus
              ? `收到。我是${mateName}，会按这个方向继续。眼下「${focus}」还需要你这边看一下。`
              : `收到。我是${mateName}，会按你刚说的继续，有结果会推给你。`
          dispatch({
            type: 'send-message',
            channelType: 'discussion',
            channelId,
            projectId,
            text: reply,
            authorId: agentId,
            role: 'agent',
          })
        }, 550)
      } else if (channelType === 'discussion') {
        window.setTimeout(() => {
          dispatch({
            type: 'send-message',
            channelType: 'discussion',
            channelId,
            projectId,
            text: '我记下了。若要形成任务，可以让我整理一条修改提议。',
            authorId: HOST_ID,
            role: 'host',
          })
        }, 550)
      }
      if (channelType === 'task') {
        const item = taskOf(channelId)
        window.setTimeout(() => {
          dispatch({
            type: 'send-message',
            channelType: 'task',
            channelId,
            projectId,
            text: `我是${nameOf(item?.ownerAgentId ?? HOST_ID)}，已收到你的说明，会按当前目标继续。`,
            authorId: item?.ownerAgentId ?? HOST_ID,
            role: item?.ownerAgentId === HOST_ID ? 'host' : 'agent',
          })
        }, 550)
      }
    },
    [nameOf, postHostProgress, state.approvals, state.projects, state.tasks, taskOf],
  )

  const fileContent = useCallback(
    (repositoryId: string, path: string) => {
      const found = state.files.find((item) => item.repositoryId === repositoryId && item.path === path)
      if (found) return found.content
      return EXTRA_FILE_CONTENTS[`${repositoryId}:${path}`]
    },
    [state.files],
  )

  const api = useMemo<Api>(
    () => ({
      state,
      dispatch,
      agent,
      agentName: nameOf,
      project,
      task: taskOf,
      activeTab,
      scope,
      pendingOf,
      openRoom,
      openHost,
      openHistory,
      openSettings,
      openBoard,
      openCli,
      openTask,
      openDiscussion,
      openOrStartProjectDiscussion,
      openTaskFiles,
      openRepoFile,
      openPr,
      closeTab,
      startVoice,
      sendText,
      postHostProgress,
      fileContent,
    }),
    [
      activeTab,
      agent,
      closeTab,
      fileContent,
      nameOf,
      openBoard,
      openCli,
      openDiscussion,
      openHistory,
      openHost,
      openOrStartProjectDiscussion,
      openPr,
      openRepoFile,
      openRoom,
      openSettings,
      openTask,
      openTaskFiles,
      pendingOf,
      postHostProgress,
      project,
      scope,
      sendText,
      startVoice,
      state,
      taskOf,
    ],
  )

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('Workspace is not ready')
  return value
}

export { HOST_AGENT, HOST_ID, PROVIDER_MODELS, QUOTA_PERCENT, REPO_TREES, SCAN_CATALOG, YOU_AGENT, YOU_ID }

export function validateNewProject(fields: NewProjectFields, projects: Project[]) {
  if (fields.source === 'local') {
    if (!fields.path.trim()) return { field: 'path', message: '请填写文件夹路径。' }
    if (fields.path.trim().length > 240) return { field: 'path', message: '路径最多 240 个字符。' }
    if (!isPlausiblePath(fields.path)) return { field: 'path', message: '请使用绝对路径、~/ 或盘符形式。' }
    const path = normalizePath(fields.path)
    const name = pathBasename(path)
    const duplicate = findDuplicate(projects, { name, path })
    if (duplicate) return { field: 'path', message: duplicate }
  }
  if (fields.source === 'clone') {
    if (!fields.repository.trim()) return { field: 'repository', message: '请填写仓库地址。' }
    if (fields.repository.trim().length > 240) return { field: 'repository', message: '仓库地址最多 240 个字符。' }
    if (!isValidRepo(fields.repository)) return { field: 'repository', message: '请使用 owner/repo、HTTP(S) 或 SSH 地址。' }
    const name = repoProjectName(fields.repository)
    const path = joinPath('~/Projects', name)
    const duplicate = findDuplicate(projects, { name, path, repository: sanitizeRepo(fields.repository) })
    if (duplicate) return { field: 'repository', message: duplicate }
  }
  if (fields.source === 'blank') {
    if (!fields.name.trim()) return { field: 'name', message: '请填写项目名称。' }
    if (!isValidName(fields.name)) return { field: 'name', message: '名称最多 36 个字符，且不能包含目录保留符号。' }
    if (fields.location && fields.location.length > 200) return { field: 'location', message: '位置最多 200 个字符。' }
    const path = joinPath(fields.location || '~/Projects', fields.name.trim())
    const duplicate = findDuplicate(projects, { name: fields.name, path })
    if (duplicate) return { field: 'name', message: duplicate }
  }
  return null
}

export function buildProject(fields: NewProjectFields): Project {
  if (fields.source === 'local') {
    const path = normalizePath(fields.path)
    return {
      id: uid('proj'),
      name: pathBasename(path),
      source: 'local',
      path,
      updatedAt: nowIso(),
    }
  }
  if (fields.source === 'clone') {
    const repository = sanitizeRepo(fields.repository)
    const name = repoProjectName(repository)
    return {
      id: uid('proj'),
      name,
      source: 'clone',
      path: joinPath('~/Projects', name),
      repository,
      updatedAt: nowIso(),
    }
  }
  const name = fields.name.trim()
  return {
    id: uid('proj'),
    name,
    source: 'blank',
    path: joinPath(fields.location || '~/Projects', name),
    updatedAt: nowIso(),
  }
}

export function makeCustomAgent(
  name: string,
  description: string,
  existingSlugs: string[],
  options?: { aiProvider?: string; aiModel?: string },
): Agent {
  const aiProvider = options?.aiProvider ?? 'Anthropic'
  const aiModel = options?.aiModel ?? (PROVIDER_MODELS[aiProvider] ?? ['Claude Sonnet'])[0]
  return {
    id: uid('agent'),
    slug: slugify(name, existingSlugs),
    name: name.trim(),
    description: description.trim(),
    source: 'custom',
    pinned: false,
    aiProvider,
    aiModel,
    reasoning: 'medium',
    tools: ['read-files'],
    skills: [],
  }
}
