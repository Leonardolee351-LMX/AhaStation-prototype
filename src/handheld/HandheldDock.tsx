import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { VoiceBar } from '../components/Composer'
import { PuzzleCompanion, type CompanionMood } from '../components/PuzzleCompanion'
import { HOST_ID, INITIAL_FILES, YOU_ID } from '../data'
import { IconChevronLeft, IconChevronRight, IconClose, IconKeyboard, IconMic, IconPlus, IconSend } from '../icons'
import { careGreeting, dayGreeting, formatTime, formatWait, uniqueOwners } from '../lib'
import { useDecisionCelebrate } from '../useDecisionCelebrate'
import { useWorkspace } from '../store'
import type { Agent, Approval, ChatMessage, Proposal, RepoFile, Task, TaskStatus } from '../types'
import { WorkspaceDialogs } from '../dialogs/WorkspaceDialogs'
import { ApprovalChoices, hasApprovalChoices } from '../components/ApprovalChoices'
import { TaskProcess, eventsForTask } from '../components/TaskProcess'
import { FileTypeMark } from '../components/FileTypeMark'
import { SurfaceLogo } from '../components/SurfaceLogo'
import { Avatar, AvatarStack, Badge, Button, Toast } from '../ui'
import './handheld.css'

const PORTRAIT = { width: 414, height: 736 }
const LANDSCAPE = { width: 736, height: 414 }

function hostGreeting(pendingCount: number) {
  if (pendingCount) {
    return `${dayGreeting()}。我在这儿。现在有 ${pendingCount} 项待核对，你准备好了我们再看。`
  }
  return careGreeting()
}


const TASK_LABEL: Record<TaskStatus, string> = {
  todo: '待执行',
  doing: '进行中',
  review: '待验收',
  done: '已完成',
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
    const message = '浏览器拦住了新窗口。请允许这个网站弹出窗口后再打开掌机。'
    if (onBlocked) onBlocked(message)
    return false
  }
  return true
}

function fitHandheldWindow(landscape: boolean) {
  const target = landscape ? LANDSCAPE : PORTRAIT
  const extraW = Math.max(0, window.outerWidth - window.innerWidth)
  const extraH = Math.max(0, window.outerHeight - window.innerHeight)
  window.resizeTo(target.width + extraW, target.height + extraH)
}


const PORT_PAGES = [
  { id: 'settings', label: '设置' },
  { id: 'home', label: '对话' },
  { id: 'room', label: '项目室' },
  { id: 'work', label: '工作' },
  { id: 'agents', label: '伙伴' },
] as const

const PAGE = { settings: 0, home: 1, room: 2, work: 3, agents: 4 } as const

function closeHandheldWindow() {
  window.open('', '_self')
  window.close()
}

type TalkTarget = { type: 'host' } | { type: 'agent'; id: string }

function talkOf(target: TalkTarget) {
  if (target.type === 'host') return { channelType: 'host' as const, channelId: 'host' }
  return { channelType: 'discussion' as const, channelId: `hh-agent-${target.id}` }
}

function fileName(path: string) {
  return path.split('/').pop() || path
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

function TalkPad({
  target,
  projectId,
}: {
  target: TalkTarget
  projectId?: string
}) {
  const { state, sendText, startVoice, agent } = useWorkspace()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [citing, setCiting] = useState(false)
  const [refs, setRefs] = useState<RepoFile[]>([])
  const [hint, setHint] = useState<'type' | 'file' | null>(null)
  const [holding, setHolding] = useState(false)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const fileSlotRef = useRef<HTMLSpanElement>(null)
  const typeSlotRef = useRef<HTMLSpanElement>(null)
  const pressRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const talking = talkOf(target)
  const person = target.type === 'host' ? agent(HOST_ID) : agent(target.id)
  const listening = Boolean(state.voice)
  const catalog = INITIAL_FILES.filter((item, index, list) => list.findIndex((row) => row.path === item.path && row.repositoryId === item.repositoryId) === index).slice(0, 8)

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const note = refs.length ? `${text.trim()}${text.trim() ? ' ' : ''}（引用：${refs.map((item) => fileName(item.path)).join('、')}）` : text.trim()
    if (!note) return
    sendText(talking.channelType, talking.channelId, note, projectId)
    setText('')
    setRefs([])
    setCiting(false)
    setTyping(false)
  }

  const startTalk = () => startVoice({ channelType: talking.channelType, channelId: talking.channelId, projectId }, 'rail')

  const hitSlot = (event: ReactPointerEvent, slot: HTMLElement | null): boolean => {
    if (!slot) return false
    const box = slot.getBoundingClientRect()
    const pad = 12
    return event.clientX >= box.left - pad && event.clientX <= box.right + pad && event.clientY >= box.top - pad && event.clientY <= box.bottom + pad
  }

  const onVoiceDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pressRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    setHolding(true)
    setDrag({ x: 0, y: 0 })
    setHint(null)
  }

  const onVoiceMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.id !== event.pointerId) return
    const next = { x: event.clientX - press.x, y: event.clientY - press.y }
    setDrag(next)
    if (hitSlot(event, fileSlotRef.current)) setHint('file')
    else if (hitSlot(event, typeSlotRef.current)) setHint('type')
    else setHint(null)
  }

  const onVoiceUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.id !== event.pointerId) return
    const overFile = hint === 'file' || hitSlot(event, fileSlotRef.current)
    const overType = hint === 'type' || hitSlot(event, typeSlotRef.current)
    pressRef.current = null
    setHolding(false)
    setDrag({ x: 0, y: 0 })
    setHint(null)
    if (overType) {
      setCiting(false)
      setTyping(true)
      window.requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    if (overFile) {
      setTyping(false)
      setCiting(true)
      return
    }
    startTalk()
  }

  if (listening) {
    return (
      <div className="hh-talkpad">
        <VoiceBar />
      </div>
    )
  }

  return (
    <div className="hh-talkpad">
      <p className="hh-talkpad-who">
        {target.type === 'host' ? '正在和 Aha · 秘书 说' : `正在和 ${person?.name ?? '子 AGENT'} · 项目 Host 说`}
      </p>
      {citing ? (
        <div className="hh-cite">
          <p className="hh-cite-label">引用文件</p>
          <ul className="hh-cite-list">
            {catalog.map((item) => {
              const selected = refs.some((row) => row.path === item.path && row.repositoryId === item.repositoryId)
              return (
                <li key={`${item.repositoryId}:${item.path}`}>
                  <button
                    type="button"
                    className={`hh-cite-item${selected ? ' is-on' : ''}`}
                    onClick={() => {
                      setRefs((current) =>
                        selected
                          ? current.filter((row) => !(row.path === item.path && row.repositoryId === item.repositoryId))
                          : [...current, item],
                      )
                    }}
                  >
                    <FileTypeMark path={item.path} size={20} />
                    <span>{fileName(item.path)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Button size="sm" variant="ghost" onClick={() => setCiting(false)}>
            完成
          </Button>
        </div>
      ) : null}
      {refs.length ? (
        <ul className="hh-cite-chips">
          {refs.map((item) => (
            <li key={`${item.repositoryId}:${item.path}`}>
              <span className="hh-cite-chip">
                <FileTypeMark path={item.path} size={20} />
                <span className="hh-cite-chip-name">{fileName(item.path)}</span>
                <button
                  type="button"
                  className="hh-cite-chip-remove"
                  aria-label={`取消引用 ${fileName(item.path)}`}
                  onClick={() =>
                    setRefs((current) =>
                      current.filter((row) => !(row.path === item.path && row.repositoryId === item.repositoryId)),
                    )
                  }
                >
                  <IconClose size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {typing ? (
        <form className="hh-composer hh-talk-composer" onSubmit={submit}>
          <input
            ref={inputRef}
            className="hh-input"
            value={text}
            placeholder={target.type === 'host' ? '和 Aha 说…' : `和${person?.name ?? '项目 Host'}说…`}
            aria-label="文字输入"
            autoFocus
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" variant="primary" size="sm" icon aria-label="发送" disabled={!text.trim() && refs.length === 0}>
            <IconSend size={16} />
          </Button>
        </form>
      ) : citing ? null : (
        <div ref={dockRef} className={`hh-orb-dock${holding ? ' is-holding' : ''}`}>
          <span
            ref={fileSlotRef}
            className={`hh-orb-slot${hint === 'file' ? ' is-hot' : ''}`}
            aria-hidden={!holding}
          >
            <IconPlus size={20} />
          </span>
          <button
            type="button"
            className={`hh-voice-orb${hint ? ` is-hint-${hint}` : ''}`}
            aria-label="语音对话"
            style={holding ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
            onPointerDown={onVoiceDown}
            onPointerMove={onVoiceMove}
            onPointerUp={onVoiceUp}
            onPointerCancel={onVoiceUp}
          >
            <IconMic size={24} />
          </button>
          <span
            ref={typeSlotRef}
            className={`hh-orb-slot${hint === 'type' ? ' is-hot' : ''}`}
            aria-hidden={!holding}
          >
            <IconKeyboard size={20} />
          </span>
        </div>
      )}
    </div>
  )
}

function AgentSwitcher({
  open,
  target,
  onSelect,
  onClose,
}: {
  open: boolean
  target: TalkTarget
  onSelect: (next: TalkTarget) => void
  onClose: () => void
}) {
  const { state, project } = useWorkspace()
  const agents = state.agents.filter((item) => item.id !== YOU_ID && item.id !== HOST_ID)
  const groups = new Map<string, Agent[]>()
  for (const item of agents) {
    const key = item.projectId ?? ''
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  if (!open) return null
  return (
    <div className="hh-picker" role="dialog" aria-label="选择对话对象">
      <button type="button" className="hh-picker-dismiss" aria-label="关闭" onClick={onClose} />
      <div className="hh-picker-sheet">
        <p className="hh-picker-title">选择对话对象</p>
        <button
          type="button"
          className={`hh-picker-row${target.type === 'host' ? ' is-on' : ''}`}
          onClick={() => {
            onSelect({ type: 'host' })
            onClose()
          }}
        >
          <PuzzleCompanion mood="present" size={48} label="Aha，秘书" />
          <span>
            <strong>Aha</strong>
            <em>秘书 · 管理全部项目，权限最高，可直达其他项目</em>
          </span>
        </button>
        {[...groups.entries()].map(([projectId, members]) => (
          <div key={projectId || 'shared'} className="hh-picker-group">
            <p className="hh-picker-kicker">{projectId ? project(projectId)?.name ?? '项目' : '工作区共享'}</p>
            {members.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`hh-picker-row${target.type === 'agent' && target.id === item.id ? ' is-on' : ''}`}
                onClick={() => {
                  onSelect({ type: 'agent', id: item.id })
                  onClose()
                }}
              >
                <Avatar agent={item} size="lg" />
                <span>
                  <strong>{item.name}</strong>
                  <em>项目 Host · {item.role || item.description}</em>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsPane({ target }: { target: TalkTarget }) {
  const { state, dispatch, agent, project } = useWorkspace()
  const person = target.type === 'host' ? agent(HOST_ID) : agent(target.id)
  const scope = target.type === 'host' ? '全部项目' : project(person?.projectId ?? '')?.name ?? '当前项目'
  return (
    <div className="hh-pane">
      <div className="hh-pane-head">
        <h1>设置</h1>
      </div>
      <ul className="hh-settings">
        <li>
          <div>
            <p className="hh-row-title">主机</p>
            <p className="hh-row-meta">未连接。连接后可在横屏里只看关键决策。</p>
          </div>
          <Button size="md" variant="primary" onClick={() => dispatch({ type: 'set-handheld-mode', mode: 'shared' })}>
            连接主机
          </Button>
        </li>
        <li>
          <div>
            <p className="hh-row-title">当前对话</p>
            <p className="hh-row-meta">
              {target.type === 'host' ? 'Aha · 秘书' : `${person?.name ?? '子 AGENT'} · 项目 Host`}
              {` · ${scope}`}
            </p>
          </div>
        </li>
        <li>
          <div>
            <p className="hh-row-title">角色说明</p>
            <p className="hh-row-meta">主 AGENT 是秘书，管理所有项目并可以直达其他项目。子 AGENT 是围绕单个项目的 Host，负责这个项目里的具体工作。</p>
          </div>
        </li>
      </ul>
    </div>
  )
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
  const shared = state.handheldMode === 'shared'
  const pending = pendingOf()
  const [reviewIndex, setReviewIndex] = useState(0)
  const [shownShared, setShownShared] = useState(shared)
  const [crossing, setCrossing] = useState<'out' | 'in' | null>(null)
  const armed = useRef(false)
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
    document.documentElement.classList.add('hh-os')
    document.title = 'Aha 掌机'
    const frame = window.requestAnimationFrame(() => fitHandheldWindow(shownShared))
    function onPointerDown() {
      armed.current = true
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !armed.current) return
      event.preventDefault()
      window.close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.documentElement.classList.remove('hh-os')
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
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
    <div className={`hh-stage${crossing ? ` is-crossing is-${crossing}` : ''}`}>
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
      ) : (
        <HomeDock
          mood={mood}
          pending={pending}
          currentIndex={currentIndex}
          celebrating={celebrating}
          onStep={stepReview}
          onVoice={startHostVoice}
        />
      )}
      <WorkspaceDialogs />
      <Toast message={state.toast} />
    </div>
  )
}

function HomeDock({
  mood,
  pending,
  currentIndex,
  celebrating,
  onStep,
}: {
  mood: CompanionMood
  pending: Approval[]
  currentIndex: number
  celebrating: boolean
  onStep: (direction: -1 | 1) => void
  onVoice: () => void
}) {
  const { state, dispatch, agent, project } = useWorkspace()
  const log = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState<number>(PAGE.home)
  const [projectId, setProjectId] = useState<string | null>(state.projects[0]?.id ?? null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [workStatus, setWorkStatus] = useState<TaskStatus | null>(null)
  const [target, setTarget] = useState<TalkTarget>({ type: 'host' })
  const [pickerOpen, setPickerOpen] = useState(false)
  const stealRef = useRef(false)
  const swipe = usePageSwipe(page, setPage, PORT_PAGES.length, stealRef)
  const talking = talkOf(target)
  const messages = state.messages.filter((message) => message.channelType === talking.channelType && message.channelId === talking.channelId)
  const mate = target.type === 'agent' ? agent(target.id) : agent(HOST_ID)
  const hostProjectId =
    mate?.projectId ?? state.tasks.find((item) => item.ownerAgentId === mate?.id)?.projectId ?? ''
  const greeting =
    target.type === 'host'
      ? hostGreeting(pending.length)
      : `${dayGreeting()}。我是${mate?.name ?? '项目 Host'}，负责「${project(hostProjectId)?.name ?? '当前项目'}」。这个项目里的事可以直接和我说。`
  const scopedPending =
    target.type === 'host'
      ? pending
      : pending.filter((item) => state.tasks.find((task) => task.id === item.taskId)?.projectId === mate?.projectId)
  const current = scopedPending[Math.min(currentIndex, Math.max(scopedPending.length - 1, 0))]

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, current?.id])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea')) return
      if (event.key === 'ArrowLeft' && page > 0) {
        event.preventDefault()
        setPage(page - 1)
      }
      if (event.key === 'ArrowRight' && page < PORT_PAGES.length - 1) {
        event.preventDefault()
        setPage(page + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page])

  return (
    <div className={`hh-device is-port is-home${page === PAGE.home ? '' : ' is-away'}`} role="application" aria-label="掌机">
      <header className="hh-home-bar">
        <p className="hh-status">未连接主机</p>
        <div className="hh-home-bar-actions">
          <Button
            size="sm"
            variant="primary"
            className="hh-link"
            onClick={() => dispatch({ type: 'set-handheld-mode', mode: 'shared' })}
          >
            连接主机
          </Button>
          <Button size="sm" variant="ghost" icon aria-label="关闭掌机" onClick={closeHandheldWindow}>
            <IconClose size={16} />
          </Button>
        </div>
      </header>

      <div
        className={`hh-swipe${swipe.dragging ? ' is-dragging' : ''}`}
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
            transform: `translateX(calc(${-page * 100}% + ${swipe.drag}px))`,
            transition: swipe.dragging ? 'none' : 'transform 240ms ease',
          }}
        >
          <section className="hh-swipe-page" aria-label="设置">
            <SettingsPane target={target} />
          </section>

          <section className={`hh-swipe-page${messages.length ? ' is-talk' : ''}`} aria-label="对话">
            <div className="hh-home-face">
              <button
                type="button"
                className="hh-companion-hit"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setPickerOpen(true)}
                aria-label="选择对话对象"
              >
                {target.type === 'host' ? (
                  <span className={`hh-companion-frame${current ? ' is-deciding' : ''}${celebrating ? ' is-celebrate' : ''}`}>
                    <PuzzleCompanion mood={mood} size={celebrating ? 160 : current ? 104 : 160} label="Aha，秘书" />
                    {celebrating ? <CelebrateBurst /> : null}
                  </span>
                ) : (
                  <span className="hh-companion-agent">
                    <Avatar agent={mate ?? { id: target.id, name: '子', role: '项目 Host' }} size="lg" />
                  </span>
                )}
                <span className="hh-companion-caption">
                  {target.type === 'host' ? 'Aha · 秘书' : `${mate?.name ?? '子 AGENT'} · 项目 Host`}
                  <em>点按切换对话对象</em>
                </span>
              </button>
            </div>
            <main className="hh-home-talk">
              {messages.length ? null : <p className="hh-greet">{greeting}</p>}
              <div className="hh-log" ref={log}>
                {messages.map((message) => (
                  <ChatLine key={message.id} message={message} person={agent(message.authorId)} />
                ))}
              </div>
              {current ? (
                <DecisionCard
                  approval={current}
                  index={Math.max(0, scopedPending.findIndex((item) => item.id === current.id))}
                  total={scopedPending.length}
                  onStep={onStep}
                />
              ) : null}
            </main>
          </section>

          <section className="hh-swipe-page" aria-label="项目室">
            <RoomPane
              projectId={projectId}
              onSelect={setProjectId}
              stealRef={stealRef}
              onOpenWork={(id, status) => {
                setProjectId(id)
                setTaskId(null)
                setWorkStatus(status ?? null)
                setPage(PAGE.work)
              }}
            />
          </section>

          <section className="hh-swipe-page" aria-label="工作">
            <WorkPane
              projectId={projectId}
              taskId={taskId}
              focusStatus={workStatus}
              onSelectTask={(id) => {
                setTaskId(id)
                if (id) setWorkStatus(null)
              }}
              onSelectProject={(id) => {
                setProjectId(id)
                setTaskId(null)
                setWorkStatus(null)
              }}
            />
          </section>

          <section className="hh-swipe-page" aria-label="伙伴">
            <AgentsPane
              agentId={agentId}
              projectId={projectId}
              onSelect={(id) => {
                setAgentId(id)
                if (id) setTarget({ type: 'agent', id })
              }}
            />
          </section>
        </div>
      </div>

      {page === PAGE.home ? (
        <TalkPad
          target={target}
          projectId={target.type === 'agent' ? mate?.projectId ?? hostProjectId ?? projectId ?? undefined : projectId ?? undefined}
        />
      ) : null}

      <AgentSwitcher
        open={pickerOpen}
        target={target}
        onSelect={(next) => {
          setTarget(next)
          if (next.type === 'agent') {
            setAgentId(next.id)
            const owned = agent(next.id)?.projectId
            if (owned) setProjectId(owned)
          }
        }}
        onClose={() => setPickerOpen(false)}
      />

      <nav className="hh-dots" aria-label="页面">
        {PORT_PAGES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`hh-dot${index === page ? ' is-active' : ''}`}
            aria-current={index === page ? 'page' : undefined}
            aria-label={item.label}
            onClick={() => setPage(index)}
          />
        ))}
      </nav>
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
          <PuzzleCompanion mood={mood} size={celebrating ? 180 : current ? 112 : 180} label="Aha，工作区助理" />
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
              <Button variant="primary" size="lg" className="hh-voice-btn" onClick={onVoice}>
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
      <div className="aha-approval-mini-top">
        {approval.blocked ? <Badge tone="warning">阻塞</Badge> : <Badge tone="warning">待审批</Badge>}
        <span>{formatWait(approval.requestedAt)}</span>
      </div>
      <p className="aha-approval-mini-title">{approval.title}</p>
      <p className="aha-approval-mini-task">{task?.name}</p>
      {hasApprovalChoices(approval) ? <ApprovalChoices approval={approval} /> : (
        <div className="aha-decision-actions">
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'rejected' })}>
            拒绝
          </Button>
          <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'resolve-approval', approvalId: approval.id, decision: 'approved' })}>
            允许
          </Button>
        </div>
      )}
      <div className="aha-decision-actions">
        <Button
          size="sm"
          variant="ghost"
          className="aha-linkish"
          onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'approval', approvalId: approval.id } })}
        >
          查看
        </Button>
      </div>
    </article>
  )
}

const REVEAL_WIDTH = 192

function ProjectRevealRow({
  open,
  selected,
  title,
  meta,
  paceTone,
  agents,
  stealRef,
  actions,
  onOpen,
  onClose,
  onSelect,
}: {
  open: boolean
  selected: boolean
  title: string
  meta: string
  paceTone: 'pending' | 'review' | 'busy' | 'idle'
  agents: { id: string; name: string; role?: string }[]
  stealRef: { current: boolean }
  actions: { key: TaskStatus; label: string; count: number; onClick: () => void }[]
  onOpen: () => void
  onClose: () => void
  onSelect: () => void
}) {
  const startRef = useRef<{ x: number; y: number; id: number; locked: 'h' | 'v' | null; opened: boolean } | null>(null)
  const dragRef = useRef(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const swipedRef = useRef(false)
  const base = open ? REVEAL_WIDTH : 0

  const finish = (pointerId: number) => {
    const start = startRef.current
    if (!start || start.id !== pointerId) return
    const x = base + dragRef.current
    if (x >= REVEAL_WIDTH * 0.4) onOpen()
    else onClose()
    startRef.current = null
    dragRef.current = 0
    setDrag(0)
    setDragging(false)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.hh-reveal-action')) return
    swipedRef.current = false
    startRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId, locked: null, opened: open }
    dragRef.current = 0
    setDrag(0)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      start.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (start.locked === 'h' && (start.opened || dx > 0)) {
        stealRef.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
        swipedRef.current = true
      } else {
        startRef.current = null
        return
      }
    }
    if (start.locked !== 'h') return
    event.preventDefault()
    const raw = base + dx
    let next = dx
    if (raw < 0) next = -base + dx * 0.28
    else if (raw > REVEAL_WIDTH) next = REVEAL_WIDTH - base + (raw - REVEAL_WIDTH) * 0.28
    dragRef.current = next
    setDrag(next)
  }

  return (
    <div className={`hh-reveal${open || dragging ? ' is-open' : ''}`}>
      <div className="hh-reveal-actions" aria-hidden={!open && !dragging}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`hh-reveal-action is-${action.key}`}
            onClick={() => {
              onClose()
              action.onClick()
            }}
          >
            <span className="hh-reveal-count">{action.count}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <div
        className="hh-reveal-front"
        style={{
          transform: `translateX(${base + drag}px)`,
          transition: dragging ? 'none' : 'transform 220ms ease',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event.pointerId)}
        onPointerCancel={(event) => finish(event.pointerId)}
        onClickCapture={(event) => {
          if (!swipedRef.current) return
          event.preventDefault()
          event.stopPropagation()
          swipedRef.current = false
        }}
      >
        <button
          type="button"
          className={`hh-row hh-row-project${selected ? ' is-selected' : ''}`}
          onClick={() => {
            if (open) onClose()
            else onSelect()
          }}
        >
          <span className="hh-row-main">
            <SurfaceLogo kind="project" size={32} />
            <span className="hh-row-copy">
              <span className="hh-row-title">{title}</span>
              <span className={`hh-row-meta aha-project-pace is-${paceTone}`}>{meta}</span>
            </span>
          </span>
          {agents.length ? <AvatarStack agents={agents} /> : null}
        </button>
      </div>
    </div>
  )
}

function RoomPane({
  projectId,
  onSelect,
  onOpenWork,
  stealRef,
}: {
  projectId: string | null
  onSelect: (id: string) => void
  onOpenWork: (id: string, status?: TaskStatus) => void
  stealRef: { current: boolean }
}) {
  const { state, dispatch, pendingOf, agent } = useWorkspace()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const keyword = query.trim().toLowerCase()
  const projects = state.projects.filter((project) => {
    if (!keyword) return true
    const hay = [project.name, project.path, ...(project.aliases ?? [])].join(' ').toLowerCase()
    return hay.includes(keyword)
  })

  return (
    <div className="hh-pane">
      <div className="hh-pane-head">
        <h1>项目室</h1>
        <Button size="md" variant="secondary" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-project' } })}>
          新建
        </Button>
      </div>
      <div className="hh-search">
        <input
          className="hh-search-input"
          type="search"
          value={query}
          placeholder="搜索项目"
          aria-label="搜索项目"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpenId(null)
          }}
        />
      </div>
      {state.projects.length === 0 ? (
        <p className="hh-empty">还没有项目。需要的时候我可以帮你建一个。</p>
      ) : projects.length === 0 ? (
        <p className="hh-empty">没有找到匹配的项目。</p>
      ) : (
        <ul className="hh-list hh-pane-scroll">
          {projects.map((project) => {
            const waiting = pendingOf(project.id).length
            const counts = {
              todo: state.tasks.filter((task) => task.projectId === project.id && task.status === 'todo').length,
              doing: state.tasks.filter((task) => task.projectId === project.id && task.status === 'doing').length,
              review: state.tasks.filter((task) => task.projectId === project.id && task.status === 'review').length,
            }
            const selected = project.id === projectId
            const paceTone = waiting ? 'pending' : counts.review ? 'review' : counts.doing ? 'busy' : 'idle'
            const paceLabel = waiting ? `${waiting} 项待核对` : counts.review ? `${counts.review} 项待验收` : counts.doing ? '忙碌' : '空闲'
            const agents = uniqueOwners(state.tasks, project.id)
              .map((id) => agent(id))
              .filter((item): item is NonNullable<typeof item> => Boolean(item))
            return (
              <li key={project.id} className="hh-room-item">
                <ProjectRevealRow
                  open={openId === project.id}
                  selected={selected}
                  title={project.name}
                  meta={paceLabel}
                  paceTone={paceTone}
                  agents={agents}
                  stealRef={stealRef}
                  onOpen={() => setOpenId(project.id)}
                  onClose={() => setOpenId((current) => (current === project.id ? null : current))}
                  onSelect={() => {
                    setOpenId(null)
                    onOpenWork(project.id)
                  }}
                  actions={(['todo', 'doing', 'review'] as const).map((status) => ({
                    key: status,
                    label: TASK_LABEL[status],
                    count: counts[status],
                    onClick: () => onOpenWork(project.id, status),
                  }))}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function HostChatPane() {
  const { state, agent, dispatch, postHostProgress } = useWorkspace()
  const log = useRef<HTMLDivElement>(null)
  const messages = state.messages.filter((message) => message.channelType === 'host')
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="hh-pane hh-pane-chat">
      <div className="hh-pane-head">
        <h1>和 Aha 对话</h1>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            dispatch({ type: 'send-message', channelType: 'host', channelId: 'host', text: '先帮我汇总一下现在的进展。' })
            window.setTimeout(() => dispatch({ type: 'host-reply', text: postHostProgress() }), 400)
          }}
        >
          询问进展
        </Button>
      </div>
      <div className="hh-log" ref={log}>
        {messages.length === 0 ? <p className="hh-empty">还没有对话。有需要决定的事，我会先推给你。</p> : null}
        {messages.map((message) => (
          <ChatLine key={message.id} message={message} person={agent(message.authorId)} />
        ))}
      </div>
      <HandheldComposer channelType="host" channelId="host" placeholder="也可以先打几个字…" />
    </div>
  )
}

function ChatLine({ message, person }: { message: ChatMessage; person?: Agent }) {
  const { state } = useWorkspace()
  const proposal = message.proposalId ? state.proposals.find((item) => item.id === message.proposalId) : undefined
  return (
    <article className={`hh-msg${message.role === 'you' ? ' is-you' : ''}`}>
      {person ? <Avatar agent={person} size="sm" /> : null}
      <div>
        <p className="hh-msg-who">
          {person?.name ?? (message.role === 'you' ? '你' : 'Aha')}
          {message.interrupted ? <span className="aha-interrupted">已打断</span> : null}
          <time>{formatTime(message.createdAt)}</time>
        </p>
        <p className="hh-msg-body">{message.text}</p>
        {proposal ? <ProposalMini proposal={proposal} /> : null}
      </div>
    </article>
  )
}

function ProposalMini({ proposal }: { proposal: Proposal }) {
  const { dispatch, agent } = useWorkspace()
  return (
    <article className="aha-decision">
      <div className="aha-decision-top">
        <Badge tone={proposal.status === 'pending' ? 'warning' : proposal.status === 'confirmed' ? 'success' : 'neutral'}>
          {proposal.status === 'pending' ? '待确认提议' : proposal.status === 'confirmed' ? '已允许' : '已拒绝'}
        </Badge>
        <span>{proposal.newTask ? '新建任务' : '修改任务'}</span>
      </div>
      <h3>{proposal.draftName ?? proposal.goal}</h3>
      <p>{proposal.goal}</p>
      <p className="aha-muted">负责人 {agent(proposal.ownerAgentId)?.name}</p>
      {proposal.status === 'pending' ? (
        <div className="aha-decision-actions">
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'resolve-proposal', proposalId: proposal.id, decision: 'discarded' })}>
            拒绝
          </Button>
          <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'resolve-proposal', proposalId: proposal.id, decision: 'confirmed' })}>
            允许
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="aha-linkish"
            onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'proposal', proposalId: proposal.id } })}
          >
            查看
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function WorkPane({
  projectId,
  taskId,
  focusStatus,
  onSelectTask,
  onSelectProject,
}: {
  projectId: string | null
  taskId: string | null
  focusStatus: TaskStatus | null
  onSelectTask: (id: string | null) => void
  onSelectProject: (id: string) => void
}) {
  const { state, agent } = useWorkspace()
  const project = state.projects.find((item) => item.id === projectId)
  const tasks = state.tasks.filter((task) => (projectId ? task.projectId === projectId : true))
  const selected = tasks.find((task) => task.id === taskId)
  const groups: TaskStatus[] = focusStatus
    ? [focusStatus, ...(['doing', 'review', 'todo', 'done'] as TaskStatus[]).filter((status) => status !== focusStatus)]
    : ['doing', 'review', 'todo', 'done']

  return (
    <div className="hh-pane">
      <div className="hh-pane-head">
        <h1>{project ? project.name : '全部工作'}</h1>
      </div>
      {state.projects.length > 1 ? (
        <div className="hh-chips" role="tablist" aria-label="项目">
          {state.projects.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`hh-chip${item.id === projectId ? ' is-active' : ''}`}
              onClick={() => {
                onSelectProject(item.id)
                onSelectTask(null)
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <TaskDetail task={selected} owner={agent(selected.ownerAgentId)} onBack={() => onSelectTask(null)} />
      ) : tasks.length === 0 ? (
        <p className="hh-empty">这个范围里还没有任务。</p>
      ) : (
        <ul className="hh-list">
          {groups.map((status) => {
            const items = tasks.filter((task) => task.status === status)
            if (!items.length) return null
            return (
              <li key={status} className={`hh-group${focusStatus === status ? ' is-focus' : ''}`}>
                <p className="hh-group-label">{TASK_LABEL[status]}</p>
                {items.map((task) => (
                  <button key={task.id} type="button" className="hh-row" onClick={() => onSelectTask(task.id)}>
                    <span className="hh-row-title">{task.name}</span>
                    <span className="hh-row-meta">{agent(task.ownerAgentId)?.name ?? '未指定'}</span>
                    <TaskProcess task={task} events={eventsForTask(state.events, task.id)} variant="compact" showTitle={false} />
                  </button>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TaskDetail({ task, owner, onBack }: { task: Task; owner?: Agent; onBack: () => void }) {
  const { state } = useWorkspace()
  return (
    <article className="hh-detail">
      <Button size="sm" variant="ghost" onClick={onBack}>
        返回列表
      </Button>
      <p className="hh-kicker">{TASK_LABEL[task.status]}</p>
      <h2>{task.name}</h2>
      <p className="hh-muted">负责人 {owner?.name ?? '未指定'}</p>
      <p>{task.goal}</p>
      <TaskProcess task={task} events={eventsForTask(state.events, task.id)} variant="full" showTitle={false} />
    </article>
  )
}

function AgentsPane({
  agentId,
  onSelect,
  projectId,
}: {
  agentId: string | null
  onSelect: (id: string | null) => void
  projectId: string | null
}) {
  const { state } = useWorkspace()
  const agents = state.agents.filter((item) => item.id !== YOU_ID && item.id !== HOST_ID)
  const current = agents.find((item) => item.id === agentId)

  if (current) {
    return <AgentChat agent={current} projectId={projectId} onBack={() => onSelect(null)} />
  }

  return (
    <div className="hh-pane">
      <div className="hh-pane-head">
        <h1>选择伙伴</h1>
      </div>
      <ul className="hh-list">
        {agents.map((item) => {
          const mine = state.tasks.filter((task) => task.ownerAgentId === item.id && task.status !== 'done')
          return (
            <li key={item.id}>
              <button type="button" className="hh-row hh-row-agent" onClick={() => onSelect(item.id)}>
                <span className="hh-row-agent-head">
                  <Avatar agent={item} size="sm" />
                  <span>
                    <span className="hh-row-title">{item.name}</span>
                    <span className="hh-row-meta">{item.role || item.description}</span>
                  </span>
                </span>
                {mine[0] ? (
                  <TaskProcess task={mine[0]} events={eventsForTask(state.events, mine[0].id)} variant="compact" />
                ) : (
                  <span className="hh-row-meta">当前空闲</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AgentChat({ agent, projectId, onBack }: { agent: Agent; projectId: string | null; onBack: () => void }) {
  const { state, agent: findAgent } = useWorkspace()
  const channelId = `hh-agent-${agent.id}`
  const log = useRef<HTMLDivElement>(null)
  const messages = state.messages.filter((message) => message.channelType === 'discussion' && message.channelId === channelId)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="hh-pane hh-pane-chat">
      <div className="hh-pane-head">
        <Button size="sm" variant="ghost" onClick={onBack}>
          返回
        </Button>
        <h1>{agent.name}</h1>
      </div>
      {state.tasks.filter((task) => task.ownerAgentId === agent.id && task.status !== 'done').length ? (
        <div className="hh-agent-process">
          {state.tasks
            .filter((task) => task.ownerAgentId === agent.id && task.status !== 'done')
            .map((task) => (
              <TaskProcess key={task.id} task={task} events={eventsForTask(state.events, task.id)} variant="full" />
            ))}
        </div>
      ) : (
        <p className="hh-empty">当前没有进行中的任务。</p>
      )}
      <div className="hh-log" ref={log}>
        {messages.length === 0 ? <p className="hh-empty">还没有和{agent.name}说过话。有进展时，也会主动推到这里。</p> : null}
        {messages.map((message) => (
          <ChatLine key={message.id} message={message} person={findAgent(message.authorId)} />
        ))}
      </div>
    </div>
  )
}

function HandheldComposer({
  channelType,
  channelId,
  projectId,
  placeholder,
  onSend,
  hideVoice,
}: {
  channelType: 'host' | 'discussion' | 'task'
  channelId: string
  projectId?: string
  placeholder: string
  onSend?: (text: string) => void
  hideVoice?: boolean
}) {
  const { sendText, startVoice, state } = useWorkspace()
  const [text, setText] = useState('')
  const listening = Boolean(state.voice)

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    sendText(channelType, channelId, trimmed, projectId)
    onSend?.(trimmed)
    setText('')
  }

  if (listening) return null

  return (
    <form className="hh-composer" onSubmit={submit}>
      <input
        className="hh-input"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
      {hideVoice ? null : (
        <Button
        type="button"
        size="sm"
        variant="secondary"
        icon
        aria-label="语音对话"
        onClick={() => startVoice({ channelType, channelId, projectId }, 'rail')}
      >
        <IconMic size={16} />
      </Button>
      )}
    </form>
  )
}

