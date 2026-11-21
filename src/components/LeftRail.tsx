import { useState } from 'react'
import { IconMic, IconPlus } from '../icons'
import { SurfaceLogo } from './SurfaceLogo'
import { PuzzleCompanion, type CompanionMood } from './PuzzleCompanion'
import { collectRailReviews, dayGreeting, formatWait } from '../lib'
import { useWorkspace } from '../store'
import { Badge, Button } from '../ui'
import { ApprovalChoices, hasApprovalChoices } from './ApprovalChoices'
import { HandheldDock } from '../handheld/HandheldDock'
import { VoiceBar } from './Composer'

export function LeftRail() {
  const { state, dispatch, openRoom, openHost, openBoard, openTask, openOrStartProjectDiscussion, startVoice, pendingOf } =
    useWorkspace()
  const last = [...state.messages].reverse().find((message) => message.role === 'host' && message.channelType !== 'task')
  const railVoice = state.voice?.target === 'rail' ? state.voice : null
  const lastIsDiscussion = last?.channelType === 'discussion'
  const sharedHandheld = state.handheldMode === 'shared'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [welcome, setWelcome] = useState(true)
  const pending = pendingOf()
  const scanning = !state.prefs.localScanDone
  const projectCount = state.projects.length
  const reviewCount = state.tasks.filter((task) => task.status === 'review').length
  const mood: CompanionMood = state.voice
    ? 'listening'
    : pending.length || scanning
      ? 'waiting'
      : welcome
        ? 'comfort'
        : 'present'

  const role = state.voice ? '语音对话' : scanning ? '扫描本地工程' : pending.length ? '逐项核对' : '信息管理'

  const greet = dayGreeting()
  const briefText = (() => {
    if (projectCount === 0) {
      return `${greet}。工作区还没有项目，需要的时候我可以帮你建一个。`
    }
    const counts = `当前 ${projectCount} 个项目，${pending.length} 项待核对，${reviewCount} 项待验收`
    if (reviewCount) {
      return `${greet}。${counts}。`
    }
    return `${greet}。${counts}，目前没有需要你决策的事项。`
  })()
  const decisionLead = pending.length
    ? `${greet}。现在有 ${pending.length} 项待核对，请你先做决定。`
    : null

  const openHostChat = () => {
    setWelcome(false)
    if (lastIsDiscussion && last?.channelId) {
      const discussion = state.discussions.find((item) => item.id === last.channelId)
      if (discussion) {
        openOrStartProjectDiscussion(discussion.projectId, { taskId: discussion.taskId })
        return
      }
    }
    openHost()
  }

  const startHostVoice = () => {
    setWelcome(false)
    const tab = state.tabs.find((item) => item.key === state.activeTabKey)
    if (tab?.kind === 'discussion' && tab.entityId) {
      startVoice({ channelType: 'discussion', channelId: tab.entityId, projectId: tab.projectId }, 'rail')
      return
    }
    if (tab?.kind === 'task' && tab.entityId) {
      startVoice({ channelType: 'task', channelId: tab.entityId, projectId: tab.projectId }, 'rail')
      return
    }
    startVoice({ channelType: 'host', channelId: 'host' }, 'rail')
  }

  return (
    <aside className="aha-left" aria-label="助理与项目队列">
      <div className="aha-aha-card">
        <div className="aha-aha-presence">
          <PuzzleCompanion mood={mood} size={88} label="Aha，工作区助理" />
          <div className="aha-aha-identity">
            <p className="aha-aha-name">Aha</p>
            <p className="aha-aha-role">{role}</p>
            {state.voice ? <p className="aha-companion-listen">我在听你说</p> : null}
          </div>
        </div>
        {sharedHandheld ? (
          <p className="aha-aha-bubble aha-aha-bubble--static">Aha 助理已整块移到掌机。在掌机上讨论、审批和说话。</p>
        ) : railVoice ? (
          <>
            <div className="aha-aha-voice-slot">
              <VoiceBar />
            </div>
            <div className="aha-aha-actions aha-aha-actions--stack">
              <Button size="sm" variant="secondary" onClick={openHostChat}>
                展开会话
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="aha-aha-review">
              <button type="button" className={`aha-aha-bubble${welcome && !scanning && !pending.length ? ' is-greet' : ''}`} onClick={openHostChat}>
                <span className="aha-aha-status">{scanning ? '扫描本地工程' : pending.length ? '逐项核对' : '信息管理'}</span>
                <p>{scanning ? `${greet}。我正在检索本机上的工作文件，找到后可以引入项目室。` : decisionLead ?? briefText}</p>
              </button>
              <RailReviewBoard
                onOpenApproval={(approvalId, taskId) => {
                  setWelcome(false)
                  dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId } })
                  if (taskId) openTask(taskId)
                }}
                onOpenProposal={(proposalId) => {
                  setWelcome(false)
                  dispatch({ type: 'set-dialog', dialog: { type: 'proposal', proposalId } })
                }}
                onOpenTask={(taskId) => {
                  setWelcome(false)
                  openTask(taskId)
                }}
              />
            </div>
            <div className="aha-aha-actions aha-aha-actions--stack">
              <Button size="lg" variant="primary" className="aha-aha-voice" onClick={startHostVoice}>
                <IconMic size={18} />
                语音对话
              </Button>
              <Button size="sm" variant="secondary" onClick={openHostChat}>
                展开会话
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="aha-rail-tools">
        <Button variant="secondary" className="aha-rail-room" onClick={() => openRoom()}>
          <SurfaceLogo kind="room" size={18} />
          项目室
        </Button>
        <Button
          variant="primary"
          icon
          size="sm"
          aria-label="新建项目"
          onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-project' } })}
        >
          <IconPlus size={16} />
        </Button>
      </div>

      <div className="aha-queue">
        <h2 className="aha-rail-heading">项目队列</h2>
        <ul className="aha-queue-list">
          {state.projects.map((project) => {
            const approvals = pendingOf(project.id)
            const existing = state.discussions.find((item) => item.projectId === project.id && !item.taskId)
            const expanded = expandedId === project.id
            return (
              <li key={project.id} className={`aha-queue-project${expanded ? ' is-expanded' : ''}`}>
                <div className="aha-queue-row">
                  <button
                    type="button"
                    className="aha-queue-name"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : project.id)}
                  >
                    <SurfaceLogo kind="project" size={18} />
                    <span className="aha-queue-name-text">{project.name}</span>
                    {!expanded && approvals.length ? (
                      <Badge tone="warning">{`待审批 ${approvals.length}`}</Badge>
                    ) : null}
                  </button>
                </div>
                {expanded ? (
                  <div className="aha-queue-panel">
                    <div className="aha-queue-actions">
                      <Button size="sm" variant="ghost" onClick={() => openBoard(project.id)}>
                        查看看板
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openOrStartProjectDiscussion(project.id)}>
                        {existing ? '打开讨论' : '＋讨论'}
                      </Button>
                    </div>
                    {approvals.length ? (
                      <ul className="aha-queue-approvals">
                        {approvals.map((approval) => {
                          const task = state.tasks.find((item) => item.id === approval.taskId)
                          return (
                            <li key={approval.id} className="aha-approval-mini is-pending">
                              <div className="aha-approval-mini-top">
                                {approval.blocked ? <Badge tone="warning">阻塞</Badge> : <Badge tone="warning">待审批</Badge>}
                                <span>{formatWait(approval.requestedAt)}</span>
                              </div>
                              <p className="aha-approval-mini-title">{approval.title}</p>
                              <p className="aha-approval-mini-task">{task?.name}</p>
                              {hasApprovalChoices(approval) ? (
                                <>
                                  <ApprovalChoices approval={approval} />
                                  <div className="aha-approval-mini-actions">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="aha-linkish"
                                      onClick={() => openTask(approval.taskId)}
                                    >
                                      查看任务
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="aha-approval-mini-actions">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'rejected' })
                                    }
                                  >
                                    拒绝
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() =>
                                      dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'approved' })
                                    }
                                  >
                                    允许
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="aha-linkish"
                                    onClick={() => openTask(approval.taskId)}
                                  >
                                    查看任务
                                  </Button>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="aha-queue-empty">这个项目目前没有待审批事项。</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="aha-rail-dock">
        <HandheldDock />
      </div>
    </aside>
  )
}

function RailReviewBoard({
  onOpenApproval,
  onOpenProposal,
  onOpenTask,
}: {
  onOpenApproval: (approvalId: string, taskId?: string) => void
  onOpenProposal: (proposalId: string) => void
  onOpenTask: (taskId: string) => void
}) {
  const { state } = useWorkspace()
  const { pending, reviewed } = collectRailReviews(state.approvals, state.proposals, state.tasks, state.projects)
  const [tab, setTab] = useState<'pending' | 'reviewed'>(pending.length ? 'pending' : 'reviewed')
  const items = tab === 'pending' ? pending : reviewed

  const openItem = (item: (typeof items)[number]) => {
    if (item.approvalId) onOpenApproval(item.approvalId, item.taskId)
    else if (item.proposalId) onOpenProposal(item.proposalId)
    else if (item.taskId) onOpenTask(item.taskId)
  }

  return (
    <div className="aha-rail-review">
      <div className="aha-rail-review-tabs" role="tablist" aria-label="核对状态">
        <button type="button" role="tab" aria-selected={tab === 'pending'} className={tab === 'pending' ? 'is-active' : ''} onClick={() => setTab('pending')}>
          待核对 {pending.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'reviewed'} className={tab === 'reviewed' ? 'is-active' : ''} onClick={() => setTab('reviewed')}>
          已核对 {reviewed.length}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="aha-rail-review-empty">{tab === 'pending' ? '现在没有待核对的事项。' : '还没有已核对的事项。'}</p>
      ) : (
        <ul className="aha-rail-review-list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="aha-rail-review-item" onClick={() => openItem(item)}>
                <Badge tone={item.tone}>{item.badge}</Badge>
                <span className="aha-rail-review-copy">
                  <strong>{item.title}</strong>
                  {item.detail ? <em>{item.detail}</em> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
