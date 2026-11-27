export type ProjectSource = 'local' | 'clone' | 'blank'
export type EntryMode = 'discussion' | 'cli'
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done'
export type AttentionKind = 'approval' | 'review' | 'working'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ProposalStatus = 'pending' | 'confirmed' | 'discarded'
export type AgentSource = 'seeded' | 'custom' | 'external'
export type ReasoningLevel = 'low' | 'medium' | 'high'
export type ChannelType = 'host' | 'discussion' | 'task'
export type MessageRole = 'you' | 'host' | 'agent' | 'system'
export type AvatarTone = 'you' | 'host' | 'expert' | 'sub'
export type EventType = 'assign' | 'step' | 'report' | 'approval' | 'acceptance' | 'chat'
export type ScopeType = 'global' | 'project' | 'task'
export type ProjectPane = 'changes' | 'files' | 'worktree'
export type ChangeType = 'modify' | 'add' | 'delete'
export type LineChange = 'equal' | 'add' | 'delete'
export type VoicePhase = 'listening' | 'sending'
export type RoomLayout = 'all' | 'one' | 'two'
export type ChatSurface = 'dialog' | 'terminal'
export type ConnectionState = 'online' | 'offline' | 'simulated'

export type TabKind =
  | 'room'
  | 'host'
  | 'history'
  | 'settings'
  | 'board'
  | 'cli'
  | 'discussion'
  | 'task'
  | 'task-file'
  | 'pr-diff'
  | 'repo-file'

export type Tab = {
  key: string
  kind: TabKind
  title: string
  projectId?: string
  entityId?: string
  filePath?: string
}

export type Project = {
  id: string
  name: string
  source: ProjectSource
  path: string
  repository?: string
  aliases?: string[]
  updatedAt: string
}

export type Agent = {
  id: string
  slug: string
  name: string
  description: string
  role?: string
  source: AgentSource
  projectId?: string
  pinned: boolean
  aiProvider: string
  aiModel: string
  systemPrompt?: string
  reasoning: ReasoningLevel
  tools: string[]
  skills: string[]
  deviceId?: string
  externalProvider?: string
  version?: string
}

export type Task = {
  id: string
  projectId: string
  name: string
  ownerAgentId: string
  goal: string
  latestUpdate: string
  status: TaskStatus
  repositoryId?: string
  branch?: string
  pullRequests?: number[]
}

export type WorkflowEvent = {
  id: string
  taskId: string
  type: EventType
  actorId: string
  recipientId?: string
  text: string
  occurredAt: string
  approvalId?: string
}

export type ApprovalOption = {
  id: string
  label: string
  description?: string
}

export type Approval = {
  id: string
  taskId: string
  kind: string
  title: string
  requestedAt: string
  blocked: boolean
  impact?: string
  detail: string
  effect: string
  options?: ApprovalOption[]
  decision?: string
  status: ApprovalStatus
  nextStatus?: TaskStatus
}

export type Discussion = {
  id: string
  projectId: string
  taskId?: string
  title: string
  goal: string
  startedAt: string
  participantIds: string[]
  relatedTaskIds: string[]
  previousRecordId?: string
  invitedIds: string[]
  mentionedIds: string[]
}

export type ChatMessage = {
  id: string
  channelType: ChannelType
  channelId: string
  projectId?: string
  authorId: string
  role: MessageRole
  text: string
  createdAt: string
  proposalId?: string
  interrupted?: boolean
}

export type Proposal = {
  id: string
  discussionId: string
  projectId: string
  taskId?: string
  newTask: boolean
  draftName?: string
  ownerAgentId: string
  oldGoal?: string
  goal: string
  acceptance: string
  status: ProposalStatus
}

export type Outcome = {
  type: 'created' | 'modified'
  sourceDraftId: string
  taskId: string
  title: string
  goal: string
  owner: string
  acceptance: string
}

export type HistoryParticipant = {
  id: string
  name: string
  role: string
}

export type HistoryLine = {
  role: string
  name: string
  text: string
  interrupted?: boolean
}

export type HistoryRecord = {
  id: string
  projectId: string
  title: string
  startedAt: string
  endedAt?: string
  goal: string
  conclusion?: string
  participants: HistoryParticipant[]
  transcript: HistoryLine[]
  relatedTaskIds: string[]
  outcomes: Outcome[]
  pendingProposal?: Proposal
  previousRecordId?: string
  transcriptTruncated?: boolean
  liveDiscussionId?: string
  continuationId?: string
}

export type Device = {
  id: string
  name: string
  connectionState: ConnectionState
  hostAddress?: string
  cpuPercent?: number
  memoryPercent?: number
  diskPercent?: number
}

export type RemoteHost = {
  id: string
  name: string
  hostAddress: string
  connectionState: ConnectionState
  remoteReconnect: boolean
}

export type RepoNode = {
  path: string
  name: string
  kind: 'dir' | 'file'
  children?: RepoNode[]
}

export type RepoFile = {
  repositoryId: string
  path: string
  ref?: string
  content: string
  taskId?: string
}

export type DiffLine = {
  oldLine?: number
  newLine?: number
  text: string
  changeType: LineChange
}

export type DiffFile = {
  path: string
  changeType: ChangeType
  added: number
  deleted: number
  hunks: DiffLine[]
}

export type PullRequest = {
  number: number
  title: string
  taskId: string
  projectId: string
  repositoryId: string
  baseRef: string
  headRef: string
  status: string
  files: DiffFile[]
}

export type VoiceState = {
  phase: VoicePhase
  origin: { channelType: ChannelType; channelId: string; projectId?: string }
  transcript: string
  target: 'rail' | 'composer'
}

export type Preferences = {
  defaultProvider: string
  inputDevice: 'system' | 'handheld'
  voiceInput: 'push' | 'continuous'
  defaultBranch: string
  newDiscussionKey: 'shift-cmd-n' | 'alt-cmd-n'
  voiceKey: 'space' | 'alt-space'
  approvalNotifications: boolean
  taskNotifications: boolean
  ahaTalkPath: 'local' | 'key' | 'cloud'
  voicePolish: boolean
  speechVoice: 'default' | 'soft' | 'firm'
  speechFilter: 'all' | 'replies' | 'decisions'
  soundMuted: boolean
  reportMode: boolean
  defaultIde: string
  layoutMode: 'desktop' | 'handheld'
  leftColWidth?: number
  rightColWidth?: number
  usageDisplay: 'remaining' | 'used'
  usageDensity: 'verbose' | 'compact'
  voiceLockEnabled: boolean
  voiceLockEnrolledAt: number | null
  acceptRemoteTasks: boolean
  chatSurfaces: Record<string, ChatSurface>
  localScanDone: boolean
}

export type ScanItem = {
  id: string
  name: string
  version: string
  status: 'available' | 'missing' | 'connected'
  hostId: string
  externalProvider: string
}

export type ProviderCheck = {
  provider: string
  model: string
  status: 'idle' | 'checking' | 'success' | 'failure'
  message?: string
}

export type ProviderAccount = {
  provider: string
  model: string
  apiKey: string
  proxyUrl: string
  status: 'idle' | 'saved' | 'checking' | 'success' | 'failure'
  message?: string
}

export type McpTransport = 'stdio' | 'sse' | 'http'

export type McpServer = {
  id: string
  name: string
  transport: McpTransport
  endpoint: string
  enabled: boolean
  tools: string[]
  status: 'idle' | 'connected' | 'error'
  detail?: string
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '待执行',
  doing: '进行中',
  review: '待验收',
  done: '已完成',
}

export const TASK_STATUS_ORDER: TaskStatus[] = ['todo', 'doing', 'review', 'done']

export const SOURCE_LABEL: Record<ProjectSource, string> = {
  local: '本机文件夹',
  clone: 'Git 克隆',
  blank: '空项目',
}
