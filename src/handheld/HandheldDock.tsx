import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { playSound } from '../audio'
import { VoiceBar } from '../components/Composer'
import { PuzzleCompanion, type CompanionMood } from '../components/PuzzleCompanion'
import { IconChevronLeft, IconChevronRight, IconMic } from '../icons'
import { careGreeting, dayGreeting, formatWait, uniqueOwners } from '../lib'
import { useDecisionCelebrate } from '../useDecisionCelebrate'
import { useWorkspace } from '../store'
import type { Approval } from '../types'
import { WorkspaceDialogs } from '../dialogs/WorkspaceDialogs'
import { ApprovalChoices, hasApprovalChoices } from '../components/ApprovalChoices'
import { SurfaceLogo } from '../components/SurfaceLogo'
import { AvatarStack, Badge, Button, Toast } from '../ui'
import { HandheldPortrait } from './HandheldPortrait'
import './handheld.css'

const PORTRAIT = { width: 414, height: 736 }
const LANDSCAPE = { width: 736, height: 414 }

function hostGreeting(pendingCount: number) {
  if (pendingCount) {
    return `${dayGreeting()}。我在这儿。现在有 ${pendingCount} 项待核对，你准备好了我们再看。`
  }
  return careGreeting()
}


const CELEBRATE_SPARKS = [
  { dx: '-28px', dy: '-40px' },
  { dx: '32px', dy: '-36px' },
  { dx: '-40px', dy: '-8px' },
  { dx: '42px', dy: '-10px' },
  { dx: '-16px', dy: '30px' },
  { dx: '20px', dy: '34px' },
]

function CelebrateBurst() {
  return (
    <span className="aha-celebrate-burst" aria-hidden="true">
      {CELEBRATE_SPARKS.map((spark, index) => (
        <span
          key={index}
          className="aha-celebrate-spark"
          style={{ '--dx': spark.dx, '--dy': spark.dy, animationDelay: `${index * 40}ms` } as CSSProperties}
        />
      ))}
    </span>
  )
}

export function openHandheldWindow(onBlocked?: (message: string) => void) {
  const url = new URL(window.location.href)
  url.searchParams.set('view', 'handheld')
  const child = window.open(
    url.toString(),
    'ahastation-handheld',
    `popup=yes,width=${PORTRAIT.width},height=${PORTRAIT.height},left=80,top=80`,
  )
  if (!child) {
    playSound('fail')
    const message = '浏览器拦住了新窗口。请允许这个网站弹出窗口后再打开掌机。'
    if (onBlocked) onBlocked(message)
    return false
  }
  playSound('dock')
  return true
}

function fitHandheldWindow(landscape: boolean) {
  const target = landscape ? LANDSCAPE : PORTRAIT
  const extraW = Math.max(0, window.outerWidth - window.innerWidth)
  const extraH = Math.max(0, window.outerHeight - window.innerHeight)
  window.resizeTo(target.width + extraW, target.height + extraH)
}


function usePageSwipe(page: number, setPage: (index: number) => void, count: number, stealRef: { current: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number; id: number; locked: 'h' | 'v' | null } | null>(null)
  const dragRef = useRef(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const swipedRef = useRef(false)

  const finish = (pointerId: number) => {
    const start = startRef.current
    if (!start || start.id !== pointerId) return
    const dx = dragRef.current
    const width = viewportRef.current?.clientWidth ?? 414
    const threshold = Math.min(72, width * 0.2)
    if (start.locked === 'h') {
      if (dx < -threshold && page < count - 1) setPage(page + 1)
      else if (dx > threshold && page > 0) setPage(page - 1)
    }
    startRef.current = null
    dragRef.current = 0
    setDrag(0)
    setDragging(false)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, select, a')) return
    swipedRef.current = false
    stealRef.current = false
    startRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId, locked: null }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stealRef.current) {
      if (startRef.current || dragRef.current) {
        startRef.current = null
        dragRef.current = 0
        setDrag(0)
        setDragging(false)
      }
      return
    }
    const start = startRef.current
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      start.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (start.locked === 'h') {
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
        swipedRef.current = true
      }
    }
    if (start.locked !== 'h') return
    event.preventDefault()
    let next = dx
    if ((page === 0 && dx > 0) || (page === count - 1 && dx < 0)) next = dx * 0.28
    dragRef.current = next
    setDrag(next)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    finish(event.pointerId)
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!swipedRef.current) return
    event.preventDefault()
    event.stopPropagation()
    swipedRef.current = false
  }

  return { viewportRef, drag, dragging, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture }
}

export function HandheldDock() {
  const { dispatch } = useWorkspace()
  return (
    <Button variant="primary" className="hh-open" onClick={() => openHandheldWindow((message) => dispatch({ type: 'toast', message }))}>
      掌机
    </Button>
  )
}

export function HandheldScreen() {
  const { state, dispatch, pendingOf, startVoice } = useWorkspace()
  const bootShared = useRef(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'shared')
  useEffect(() => {
    if (!bootShared.current) return
    bootShared.current = false
    dispatch({ type: 'set-handheld-mode', mode: 'shared' })
  }, [dispatch])
  const shared = state.handheldMode === 'shared' || bootShared.current
  const pending = pendingOf()
  const [reviewIndex, setReviewIndex] = useState(0)
  const [shownShared, setShownShared] = useState(shared)
  const [crossing, setCrossing] = useState<'out' | 'in' | null>(null)
  const celebrating = useDecisionCelebrate(pending.length)
  const mood: CompanionMood = state.voice ? 'listening' : celebrating ? 'comfort' : pending.length ? 'waiting' : 'comfort'
  const currentIndex = pending.length ? Math.min(reviewIndex, pending.length - 1) : 0

  const stepReview = (direction: -1 | 1) => {
    if (!pending.length) return
    setReviewIndex((index) => {
      const current = Math.min(index, pending.length - 1)
      return Math.min(pending.length - 1, Math.max(0, current + direction))
    })
  }

  useEffect(() => {
    playSound('dock')
    const onBeforeUnload = () => playSound('undock')
    window.addEventListener('beforeunload', onBeforeUnload)
    document.documentElement.classList.add('hh-os')
    document.title = 'Aha 掌机'
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.documentElement.classList.remove('hh-os')
    }
  }, [])

  useEffect(() => {
    if (shared === shownShared) return
    setCrossing('out')
    const swap = window.setTimeout(() => {
      setShownShared(shared)
      setCrossing('in')
    }, 280)
    return () => window.clearTimeout(swap)
  }, [shared, shownShared])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => fitHandheldWindow(shownShared))
    return () => window.cancelAnimationFrame(id)
  }, [shownShared])

  useEffect(() => {
    if (crossing !== 'in') return
    const done = window.setTimeout(() => setCrossing(null), 520)
    return () => window.clearTimeout(done)
  }, [crossing])

  const startHostVoice = () => startVoice({ channelType: 'host', channelId: 'host' }, 'rail')

  return (
    <div
      className={`hh-stage${crossing ? ` is-crossing is-${crossing}` : ''}`}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('button, [role="switch"]')) playSound('click')
      }}
    >
      <span className="hh-stage-glow" aria-hidden="true" />
      {shownShared ? (
        <ConnectedDock
          mood={mood}
          pending={pending}
          currentIndex={currentIndex}
          celebrating={celebrating}
          onStep={stepReview}
          onVoice={startHostVoice}
        />
      ) : <HandheldPortrait />}
      <WorkspaceDialogs />
      <Toast message={state.toast} />
    </div>
  )
}

function DockRoomCards() {
  const { state, pendingOf, agent, openBoard } = useWorkspace()
  if (state.projects.length === 0) {
    return <p className="hh-empty">还没有项目室。建好之后会在这里列出。</p>
  }
  return (
    <ul className="hh-dock-rooms">
      {state.projects.map((project) => {
        const waiting = pendingOf(project.id).length
        const doing = state.tasks.filter((task) => task.projectId === project.id && task.status === 'doing').length
        const review = state.tasks.filter((task) => task.projectId === project.id && task.status === 'review').length
        const paceTone = waiting ? 'pending' : review ? 'review' : doing ? 'busy' : 'idle'
        const paceLabel = waiting ? `${waiting} 项待核对` : review ? `${review} 项待验收` : doing ? '忙碌' : '空闲'
        const agents = uniqueOwners(state.tasks, project.id)
          .map((id) => agent(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
        return (
          <li key={project.id}>
            <button type="button" className="hh-dock-room" onClick={() => openBoard(project.id)}>
              <span className="hh-row-main">
                <SurfaceLogo kind="project" size={32} />
                <span className="hh-row-copy">
                  <span className="hh-dock-room-title">{project.name}</span>
                  <span className={`aha-project-pace is-${paceTone}`}>{paceLabel}</span>
                </span>
              </span>
              {agents.length ? <AvatarStack agents={agents} /> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ConnectedDock({
  mood,
  pending,
  currentIndex,
  celebrating,
  onStep,
  onVoice,
}: {
  mood: CompanionMood
  pending: Approval[]
  currentIndex: number
  celebrating: boolean
  onStep: (direction: -1 | 1) => void
  onVoice: () => void
}) {
  const { state, dispatch } = useWorkspace()
  const current = pending[currentIndex]
  const greeting = hostGreeting(pending.length)
  const [pane, setPane] = useState(1)
  const stealRef = useRef(false)
  const swipe = usePageSwipe(pane, setPane, 2, stealRef)

  return (
    <div className="hh-device is-land is-docked" role="application" aria-label="掌机">
      <aside className="hh-dock-face">
        <span className={`hh-companion-frame${current ? ' is-deciding' : ''}${celebrating ? ' is-celebrate' : ''}`}>
          <PuzzleCompanion mood={mood} size={120} label="Aha，工作区助理" />
          {celebrating ? <CelebrateBurst /> : null}
        </span>
        <p className="hh-name">Aha</p>
        <p className="hh-status">{celebrating ? '都核对完了' : state.voice ? '我在听你说' : '已连上主机'}</p>
        <Button
          size="sm"
          variant="secondary"
          className="hh-link"
          onClick={() => dispatch({ type: 'set-handheld-mode', mode: 'independent' })}
        >
          断开
        </Button>
      </aside>

      <div
        className={`hh-dock-swipe${swipe.dragging ? ' is-dragging' : ''}`}
        ref={swipe.viewportRef}
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
        onClickCapture={swipe.onClickCapture}
      >
        <div
          className="hh-swipe-track"
          style={{
            transform: `translateX(calc(${-pane * 100}% + ${swipe.drag}px))`,
            transition: swipe.dragging ? 'none' : 'transform 240ms ease',
          }}
        >
          <section className="hh-swipe-page hh-dock-rooms-page" aria-label="项目室">
            <p className="hh-dock-rooms-kicker">项目室</p>
            <DockRoomCards />
          </section>
          <section className="hh-swipe-page hh-dock-main" aria-label="主机">
            <p className="hh-greet">{greeting}</p>
            {current ? (
              <DecisionCard approval={current} index={currentIndex} total={pending.length} onStep={onStep} />
            ) : null}
            {state.voice ? (
              <div className="hh-voice-slot">
                <VoiceBar />
              </div>
            ) : (
              <Button variant="primary" size="md" className="hh-voice-btn" onClick={onVoice}>
                <IconMic size={18} />
                语音对话
              </Button>
            )}
          </section>
        </div>
        <nav className="hh-dock-dots" aria-label="屏幕">
          <button
            type="button"
            className={`hh-dot${pane === 0 ? ' is-active' : ''}`}
            aria-label="项目室"
            aria-current={pane === 0 ? 'page' : undefined}
            onClick={() => setPane(0)}
          />
          <button
            type="button"
            className={`hh-dot${pane === 1 ? ' is-active' : ''}`}
            aria-label="主机"
            aria-current={pane === 1 ? 'page' : undefined}
            onClick={() => setPane(1)}
          />
        </nav>
      </div>
    </div>
  )
}

function DecisionCard({
  approval,
  index,
  total,
  onStep,
}: {
  approval: Approval
  index: number
  total: number
  onStep: (direction: -1 | 1) => void
}) {
  const { state, dispatch } = useWorkspace()
  const task = state.tasks.find((item) => item.id === approval.taskId)
  const hasChoices = hasApprovalChoices(approval)
  return (
    <article className="hh-push-card">
      <div className="hh-push-head">
        <span className="hh-push-kicker">请先决策</span>
        <div className="hh-push-stepper">
          {total > 1 ? (
            <Button size="sm" variant="ghost" icon disabled={index === 0} aria-label="上一项" onClick={() => onStep(-1)}>
              <IconChevronLeft size={14} />
            </Button>
          ) : null}
          <span className="hh-push-index">
            第 {index + 1} / {total} 项
          </span>
          {total > 1 ? (
            <Button size="sm" variant="ghost" icon disabled={index >= total - 1} aria-label="下一项" onClick={() => onStep(1)}>
              <IconChevronRight size={14} />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="hh-push-meta">
        {approval.blocked ? <Badge tone="warning">阻塞</Badge> : <Badge tone="warning">待审批</Badge>}
        <span>{formatWait(approval.requestedAt)}</span>
      </div>
      <h3 className="hh-push-title">{approval.title}</h3>
      {task?.name ? <p className="hh-push-task">{task.name}</p> : null}
      {hasChoices ? (
        <div className={`hh-push-choices${approval.options?.length === 2 ? ' is-pair' : ''}`}>
          <ApprovalChoices approval={approval} />
        </div>
      ) : null}
      <div className="hh-push-actions">
        {!hasChoices ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'rejected' })}>
              拒绝
            </Button>
            <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'approved' })}>
              允许
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="hh-push-view"
          onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId: approval.id } })}
        >
          查看
        </Button>
      </div>
    </article>
  )
}
