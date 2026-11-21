import { useEffect, useState, type CSSProperties } from 'react'
import { IconChevronLeft, IconChevronRight, IconMic, IconPlus } from '../icons'
import { PuzzleCompanion, type CompanionMood } from './PuzzleCompanion'
import { VoiceBar } from './Composer'
import { ApprovalChoices, hasApprovalChoices } from './ApprovalChoices'
import { attentionItems, careGreeting, dayGreeting, formatWait } from '../lib'
import { useDecisionCelebrate } from '../useDecisionCelebrate'
import { useWorkspace } from '../store'
import type { Approval } from '../types'
import { Badge, Button } from '../ui'

const SPARKS = [
  { dx: '-36px', dy: '-52px' },
  { dx: '40px', dy: '-48px' },
  { dx: '-52px', dy: '-10px' },
  { dx: '54px', dy: '-14px' },
  { dx: '-22px', dy: '40px' },
  { dx: '26px', dy: '44px' },
]

function CelebrateBurst() {
  return (
    <span className="aha-celebrate-burst" aria-hidden="true">
      {SPARKS.map((spark, index) => (
        <span
          key={index}
          className="aha-celebrate-spark"
          style={{ '--dx': spark.dx, '--dy': spark.dy, animationDelay: `${index * 40}ms` } as CSSProperties}
        />
      ))}
    </span>
  )
}

export function HostBriefing({ variant = 'room' }: { variant?: 'room' | 'empty' }) {
  const { state, dispatch, openHost, openRoom, openTask, startVoice, pendingOf } = useWorkspace()
  const pending = pendingOf()
  const celebrating = useDecisionCelebrate(pending.length)
  const [decideOpen, setDecideOpen] = useState(false)
  const projectCount = state.projects.length
  const reviewCount = state.tasks.filter((task) => task.status === 'review').length
  const listening = Boolean(state.voice)
  const home = variant === 'empty'
  const greet = dayGreeting()
  const deciding = pending.length > 0
  const highlights =
    pending.length === 0 && !celebrating
      ? state.projects.flatMap((project) => attentionItems(project.id, state.tasks, state.approvals, 2)).slice(0, 2)
      : []

  const mood: CompanionMood = listening
    ? 'listening'
    : celebrating
      ? 'comfort'
      : pending.length
        ? 'waiting'
        : reviewCount
          ? 'present'
          : 'comfort'
  const role = listening
    ? '语音对话'
    : celebrating
      ? '核对完成'
      : pending.length
        ? '逐项核对'
        : reviewCount
          ? '待验收跟进'
          : '信息管理'
  const status = celebrating ? '都核对完了' : pending.length ? '请先决策' : '信息管理'

  const lead = (() => {
    if (celebrating) return `${greet}。刚才的事项都核对完了，也记得适当休息一下。`
    if (pending.length) return `${greet}。现在有 ${pending.length} 项待核对，请你先做决定。`
    if (projectCount === 0) return `${careGreeting()} 工作区还没有项目，想开的时候我陪你建一个。`
    return careGreeting()
  })()

  const openPending = (approvalId: string, taskId: string) => {
    dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId } })
    openTask(taskId)
  }

  const openFirstReview = () => {
    const review = state.tasks.find((task) => task.status === 'review')
    if (review) openTask(review.id)
    else openRoom()
  }

  const stats = (
    <ul className="aha-briefing-stats">
      <li>
        <button type="button" className="aha-briefing-stat" onClick={() => openRoom()}>
          <strong>{projectCount}</strong>
          <span>个项目</span>
        </button>
      </li>
      <li>
        <button
          type="button"
          className={`aha-briefing-stat${pending.length ? ' is-priority' : ''}`}
          onClick={() => {
            if (pending.length) setDecideOpen(true)
          }}
        >
          <strong>{pending.length}</strong>
          <span>项待核对</span>
        </button>
      </li>
      <li>
        <button type="button" className={`aha-briefing-stat${reviewCount && !pending.length ? ' is-review' : ''}`} onClick={openFirstReview}>
          <strong>{reviewCount}</strong>
          <span>项待验收</span>
        </button>
      </li>
    </ul>
  )

  const items = (
    <>
      {pending.length ? (
        home ? (
          <BriefingDecisionStack pending={pending} open={decideOpen} onOpenChange={setDecideOpen} />
        ) : (
          <ul className="aha-briefing-items">
            {pending.slice(0, 3).map((approval) => {
              const task = state.tasks.find((item) => item.id === approval.taskId)
              const project = state.projects.find((item) => item.id === task?.projectId)
              return (
                <li key={approval.id}>
                  <button
                    type="button"
                    className="aha-attention is-pending aha-briefing-item"
                    onClick={() => openPending(approval.id, approval.taskId)}
                  >
                    <div className="aha-attention-top">
                      <Badge tone="warning">{approval.blocked ? '阻塞' : '待审批'}</Badge>
                      <span>{formatWait(approval.requestedAt)}</span>
                    </div>
                    <h3>{approval.title}</h3>
                    <p>
                      {task?.name}
                      {project ? ` · ${project.name}` : ''}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : null}

      {highlights.length ? (
        <ul className="aha-briefing-items">
          {highlights.map((item) => (
            <li key={`${item.kind}-${item.task.id}`}>
              <button type="button" className="aha-attention aha-briefing-item" onClick={() => openTask(item.task.id)}>
                <div className="aha-attention-top">
                  <Badge tone={item.kind === 'review' ? 'success' : 'soft'}>{item.kind === 'review' ? '待验收' : '进行中'}</Badge>
                </div>
                <h3>{item.task.name}</h3>
                <p>{item.task.latestUpdate}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )

  const homeActions = (
    <div className="aha-briefing-actions">
      {listening ? (
        <div className="aha-briefing-voice-slot">
          <VoiceBar />
        </div>
      ) : (
        <button
          type="button"
          className="aha-briefing-orb"
          aria-label="语音对话"
          onClick={() => startVoice({ channelType: 'host', channelId: 'host' }, 'composer')}
        >
          <IconMic size={24} />
        </button>
      )}
      <div className="aha-briefing-secondary">
        <Button size="md" variant="ghost" onClick={() => openHost()}>
          展开会话
        </Button>
        <Button size="md" variant="secondary" onClick={() => openRoom()}>
          打开项目室
        </Button>
        <Button size="md" variant="ghost" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-project' } })}>
          <IconPlus size={16} />
          新建项目
        </Button>
      </div>
    </div>
  )

  const companionSize = home ? (celebrating ? 200 : deciding ? 120 : 200) : 64

  if (home) {
    return (
      <section
        className={`aha-briefing is-home${pending.length ? ' is-decision' : ''}${deciding ? ' is-deciding' : ''}${celebrating ? ' is-celebrate' : ''}`}
        aria-label="Aha 工作简报"
      >
        <div className="aha-briefing-hero">
          <div className={`aha-briefing-cast${celebrating ? ' is-celebrate' : ''}`}>
            <PuzzleCompanion mood={mood} size={companionSize} label="Aha，工作区助理" />
            {celebrating ? <CelebrateBurst /> : null}
          </div>
          <div className="aha-briefing-hero-main">
            <div className="aha-briefing-identity">
              <p className="aha-aha-name">Aha</p>
              <p className="aha-aha-role">{role}</p>
              <span className="aha-aha-status">{status}</span>
            </div>
            {stats}
          </div>
        </div>
        <p className="aha-briefing-lead">{lead}</p>
        {items}
        {homeActions}
      </section>
    )
  }

  return (
    <section className={`aha-briefing${pending.length ? ' is-decision' : ''}${celebrating ? ' is-celebrate' : ''}`} aria-label="Aha 工作简报">
      <div className={`aha-briefing-presence${celebrating ? ' is-celebrate' : ''}`}>
        <PuzzleCompanion mood={mood} size={companionSize} label="Aha，工作区助理" />
        {celebrating ? <CelebrateBurst /> : null}
        <div>
          <p className="aha-aha-name">Aha</p>
          <p className="aha-aha-role">{role}</p>
          {state.voice ? <p className="aha-companion-listen">我在听你说</p> : null}
        </div>
      </div>
      {pending.length ? <span className="aha-aha-status">请先决策</span> : <span className="aha-aha-status">{celebrating ? '都核对完了' : '信息管理'}</span>}
      <p className="aha-briefing-lead">{lead}</p>
      {items}
      {stats}
      <div className="aha-briefing-actions">
        {listening ? (
          <p className="aha-briefing-listening">我正在左侧听你说，直接开口即可。</p>
        ) : (
          <Button size="lg" variant="primary" onClick={() => startVoice({ channelType: 'host', channelId: 'host' }, 'rail')}>
            <IconMic size={18} />
            语音对话
          </Button>
        )}
        <div className="aha-briefing-secondary">
          <Button size="md" variant="ghost" onClick={() => openHost()}>
            展开会话
          </Button>
        </div>
      </div>
    </section>
  )
}

function BriefingDecisionStack({
  pending,
  open,
  onOpenChange,
}: {
  pending: Approval[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, dispatch } = useWorkspace()
  const [index, setIndex] = useState(0)
  const safeIndex = Math.min(index, Math.max(pending.length - 1, 0))
  const current = pending[safeIndex]
  const layers = Math.min(pending.length, 3)

  useEffect(() => {
    if (index > pending.length - 1) setIndex(Math.max(0, pending.length - 1))
    if (pending.length === 0) onOpenChange(false)
  }, [pending.length, index, onOpenChange])

  if (!current) return null

  const task = state.tasks.find((item) => item.id === current.taskId)
  const project = state.projects.find((item) => item.id === task?.projectId)
  const defer = () => {
    if (safeIndex < pending.length - 1) setIndex(safeIndex + 1)
    else onOpenChange(false)
  }

  const front = (
    <article className="aha-approval-mini is-pending aha-decision-stack-front">
      <div className="aha-decision-stack-head">
        <span className="aha-decision-stack-kicker">请先决策</span>
        <div className="aha-decision-stack-stepper">
          {open && pending.length > 1 ? (
            <Button size="sm" variant="ghost" icon disabled={safeIndex === 0} aria-label="上一项" onClick={() => setIndex(safeIndex - 1)}>
              <IconChevronLeft size={14} />
            </Button>
          ) : null}
          <span>
            第 {safeIndex + 1} / {pending.length} 项
          </span>
          {open && pending.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              icon
              disabled={safeIndex >= pending.length - 1}
              aria-label="下一项"
              onClick={() => setIndex(safeIndex + 1)}
            >
              <IconChevronRight size={14} />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="aha-approval-mini-top">
        {current.blocked ? <Badge tone="warning">阻塞</Badge> : <Badge tone="warning">待审批</Badge>}
        <span>{formatWait(current.requestedAt)}</span>
      </div>
      <p className="aha-approval-mini-title">{current.title}</p>
      <p className="aha-approval-mini-task">
        {task?.name}
        {project ? ` · ${project.name}` : ''}
      </p>
      {open ? (
        <>
          {hasApprovalChoices(current) ? <ApprovalChoices approval={current} /> : (
            <div className="aha-decision-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: 'resolve-approval', approvalId: current.id, decision: 'rejected' })}
              >
                拒绝
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => dispatch({ type: 'resolve-approval', approvalId: current.id, decision: 'approved' })}
              >
                允许
              </Button>
            </div>
          )}
          <div className="aha-decision-actions">
            <Button
              size="sm"
              variant="ghost"
              className="aha-linkish"
              onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId: current.id } })}
            >
              查看
            </Button>
            <Button size="sm" variant="ghost" className="aha-linkish" onClick={defer}>
              稍后决策
            </Button>
          </div>
        </>
      ) : (
        <p className="aha-decision-stack-hint">点按后逐项决策</p>
      )}
    </article>
  )

  if (!open) {
    return (
      <button
        type="button"
        className="aha-decision-stack is-folded"
        style={{ '--layers': layers } as CSSProperties}
        onClick={() => onOpenChange(true)}
        aria-label={`${pending.length} 项待核对，点按后逐项决策`}
      >
        {Array.from({ length: layers - 1 }, (_, i) => (
          <span key={i} className="aha-decision-stack-peek" style={{ '--peek': layers - 1 - i } as CSSProperties} />
        ))}
        {front}
      </button>
    )
  }

  return (
    <div className="aha-decision-stack is-open" style={{ '--layers': layers } as CSSProperties}>
      {Array.from({ length: layers - 1 }, (_, i) => (
        <span key={i} className="aha-decision-stack-peek" style={{ '--peek': layers - 1 - i } as CSSProperties} />
      ))}
      {front}
    </div>
  )
}
