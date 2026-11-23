import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { PuzzleCompanion } from '../components/PuzzleCompanion'
import { IconChevronLeft, IconChevronRight, IconHistory, IconKeyboard, IconLink, IconMic } from '../icons'
import { useWorkspace } from '../store'
import { HandheldBoard, HandheldDiscussion, HandheldProjects, sendHandheldDiscussionText } from './HandheldProjects'
import { HandheldTask } from './HandheldTask'
import { PortraitApproval, PortraitComposer, PortraitDialog, PortraitMessage } from './PortraitUI'
import './handheld-portrait.css'

type View = { kind: 'home' | 'projects' } | { kind: 'discussion' | 'board' | 'task'; id: string }
type Entry = { key: number; view: View; trigger?: HTMLElement }
type Capture = { view: View; transcript: string; listening: boolean }
type Reply = { user: string; text: string; fading: boolean }

const MODEL_QUOTAS = [
  { model: 'Claude', remaining: 12, color: 'var(--aha-data-aqua)' },
  { model: 'GLM', remaining: 48, color: 'var(--aha-blue-300)' },
  { model: 'GPT', remaining: 65, color: 'var(--aha-blue-400)' },
  { model: 'Grok', remaining: 16, color: 'var(--aha-spectrum-white)' },
  { model: 'GML', remaining: 89, color: 'var(--aha-aqua)' },
]

function VoiceKey({ compact = false, disabled, onStart, onRelease, onCancel }: {
  compact?: boolean
  disabled: boolean
  onStart: () => void
  onRelease: () => void
  onCancel: () => void
}) {
  const held = useRef(false)
  const isVoiceKey = (event: KeyboardEvent<HTMLButtonElement>) => event.key === ' ' || event.key === 'Enter'
  return (
    <button
      type="button"
      className={`hhp-voice-key${compact ? ' is-compact' : ''}`}
      data-hhp-noswipe
      aria-label={compact ? 'Aha 助理，按住说话' : '按住说话'}
      aria-disabled={disabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return
        held.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        onStart()
      }}
      onPointerUp={() => {
        if (!held.current) return
        held.current = false
        onRelease()
      }}
      onPointerCancel={() => {
        held.current = false
        onCancel()
      }}
      onLostPointerCapture={() => {
        if (!held.current) return
        held.current = false
        onCancel()
      }}
      onKeyDown={(event) => {
        if (!isVoiceKey(event)) return
        event.preventDefault()
        if (disabled || event.repeat || held.current) return
        held.current = true
        onStart()
      }}
      onKeyUp={(event) => {
        if (!isVoiceKey(event)) return
        event.preventDefault()
        if (!held.current) return
        held.current = false
        onRelease()
      }}
      onBlur={() => {
        if (!held.current) return
        held.current = false
        onCancel()
      }}
    >
      <IconMic size={17} />
      <span>按住说话</span>
    </button>
  )
}

function VoicePreview({ capture, onCancel, onSend }: { capture: Capture; onCancel: () => void; onSend: () => void }) {
  return (
    <section className="hhp-voice-preview" data-hhp-noswipe aria-label="语音转写">
      <div className="hhp-voice-preview-head">
        <strong>{capture.listening ? '我在听，请说' : '转写预览'}</strong>
        {capture.listening && <span className="hhp-voice-wave" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((bar) => (
          <i key={bar} style={{ animationDelay: `${bar * 65}ms` }} />
        ))}</span>}
      </div>
      <p>{capture.transcript || '请开始说话…'}</p>
      {!capture.listening && <div className="hhp-dialog-actions">
        <button type="button" className="hhp-button" onClick={onCancel}>取消</button>
        <button type="button" className="hhp-button is-primary" onClick={onSend} disabled={!capture.transcript.trim()}>发送</button>
      </div>}
    </section>
  )
}

export function HandheldPortrait() {
  const workspace = useWorkspace()
  const { state, dispatch, pendingOf, project, task, sendText, postHostProgress } = workspace
  const [stack, setStack] = useState<Entry[]>([{ key: 0, view: { kind: 'home' } }])
  const [expanded, setExpanded] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [approvalId, setApprovalId] = useState<string | null>(null)
  const [strategy, setStrategy] = useState('')
  const [capture, setCapture] = useState<Capture | null>(null)
  const [reply, setReply] = useState<Reply | null>(null)
  const nextKey = useRef(1)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const assistantRef = useRef<HTMLElement>(null)
  const approvalSection = useRef<HTMLElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const toolRef = useRef<HTMLDivElement>(null)
  const historyLogRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ id: number; x: number; y: number; locked: boolean } | null>(null)
  const suppressClick = useRef(false)
  const timers = useRef<number[]>([])
  const active = stack[stack.length - 1]
  const view = active.view
  const onHome = view.kind === 'home'
  const queue = pendingOf()
  const processed = state.approvals.filter((item) => item.status !== 'pending')
  const reviewable = state.tasks.filter((item) => item.status === 'review' && !queue.some((approval) => approval.taskId === item.id))
  const approvals = expanded ? [...queue, ...processed] : queue.slice(0, 1)
  const selectedApproval = state.approvals.find((item) => item.id === approvalId && item.status === 'pending')
  const hostMessages = state.messages.filter((message) => message.channelType === 'host' && message.channelId === 'host')
  const latestReply = hostMessages.findLast((message) => message.role === 'host')
  const accepted = state.events.findLast((event) => event.type === 'acceptance' && event.text.startsWith('已通过'))
  const acceptedProject = project(task(accepted?.taskId)?.projectId)
  const acceptedCount = acceptedProject ? state.tasks.filter((item) => item.projectId === acceptedProject.id && item.status === 'done' &&
    state.events.some((event) => event.taskId === item.id && event.type === 'acceptance' && event.text.startsWith('已通过'))).length : 0
  const brief = [
    queue.length ? `${queue.length} 条待审批` : reviewable.length ? `${reviewable.length} 项待验收` : '暂无待处理事项',
    acceptedCount ? `${acceptedProject?.name} ${acceptedCount} 项已验收` : '',
  ].filter(Boolean).join('，')

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  useEffect(() => {
    if (!keyboardOpen || !onHome) return
    toolRef.current?.querySelector('textarea')?.focus()
  }, [keyboardOpen, onHome])
  useEffect(() => {
    if (historyOpen && historyLogRef.current) historyLogRef.current.scrollTop = historyLogRef.current.scrollHeight
  }, [historyOpen, hostMessages.length])
  const homeCapture = capture?.view.kind === 'home'
  useEffect(() => {
    if (homeCapture) assistantRef.current?.scrollIntoView({ block: 'start' })
  }, [homeCapture])
  useEffect(() => {
    if (!capture?.listening) return
    const sample = capture.view.kind === 'task' ? '请更新一下当前任务的进度和下一步安排。'
      : capture.view.kind === 'discussion' ? '请总结这个项目的进展和需要我确认的事项。' : '帮我汇总一下项目进展，以及有哪些审批需要我处理。'
    let length = 0
    const timer = window.setInterval(() => {
      length += 1
      setCapture((current) => current?.listening ? { ...current, transcript: sample.slice(0, length) } : current)
      if (length >= sample.length) window.clearInterval(timer)
    }, 45)
    return () => window.clearInterval(timer)
  }, [capture?.listening, capture?.view])

  const push = (next: View) => {
    if (capture) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const entry = { key: nextKey.current++, view: next, trigger }
    setStack((current) => [...current, entry])
    window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }
  const back = () => {
    if (stack.length <= 1) return
    const trigger = active.trigger
    setStack((current) => current.slice(0, -1))
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true })
      else headingRef.current?.focus({ preventScroll: true })
    })
  }
  const openProjects = () => push({ kind: 'projects' })
  const openTask = (id: string) => push({ kind: 'task', id })
  const showApproval = (id: string) => {
    setStrategy('')
    setApprovalId(id)
  }
  const startCapture = () => {
    if (capture || reply) return
    setCapture({ view, listening: true, transcript: '' })
  }
  const releaseCapture = () => setCapture((current) => current?.listening ? { ...current, listening: false } : current)
  const cancelCapture = () => setCapture(null)

  const sendHome = (text: string) => {
    if (reply) return
    const named = state.projects.find((item) => text.includes(item.name) || item.aliases?.some((alias) => text.includes(alias)))
    const answer = postHostProgress(named?.id)
    dispatch({ type: 'send-message', channelType: 'host', channelId: 'host', text })
    setReply({ user: text, text: '', fading: false })
    let length = 0
    const stream = () => {
      length = Math.min(answer.length, length + 3)
      setReply((current) => current && { ...current, text: answer.slice(0, length) })
      if (length < answer.length) {
        timers.current.push(window.setTimeout(stream, 30))
      } else {
        dispatch({ type: 'host-reply', text: answer })
      }
    }
    const finish = () => {
      timers.current = []
      setReply(null)
    }
    timers.current.push(window.setTimeout(() => {
      stream()
      timers.current.push(window.setTimeout(() => setReply((current) => current && { ...current, fading: true }), 170))
      timers.current.push(window.setTimeout(finish, Math.max(570, Math.ceil(answer.length / 3) * 30 + 20)))
    }, 640))
  }
  const sendCapture = () => {
    if (!capture?.transcript.trim() || capture.listening) return
    const { view: origin, transcript } = capture
    setCapture(null)
    if (origin.kind === 'task') {
      sendText('task', origin.id, transcript, task(origin.id)?.projectId)
      const draft = state.drafts.tasks[origin.id]
      if (draft) dispatch({ type: 'set-draft', channelType: 'task', channelId: origin.id, text: draft })
    } else if (origin.kind === 'board' || origin.kind === 'discussion') {
      if (origin.kind === 'board') back()
      sendHandheldDiscussionText(workspace, origin.id, transcript)
      const thread = state.discussions.find((item) => item.projectId === origin.id && !item.taskId)
      const draft = thread && state.drafts.discussions[thread.id]
      if (thread && draft) dispatch({ type: 'set-draft', channelType: 'discussion', channelId: thread.id, text: draft })
    } else {
      if (origin.kind === 'projects') back()
      sendHome(transcript)
      if (state.drafts.host) dispatch({ type: 'set-draft', channelType: 'host', channelId: 'host', text: state.drafts.host })
    }
  }

  const canSwipe = () => !capture && !document.querySelector('dialog[open], [aria-modal="true"]')
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false
    if (!canSwipe() || event.button !== 0 || (event.target as HTMLElement).closest('input, textarea, select, a, [data-hhp-noswipe]')) return
    if (event.pointerType === 'mouse' && (event.target as HTMLElement).closest('p, time, pre')) return
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, locked: false }
  }
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    if (!start || start.id !== event.pointerId || start.locked) return
    const dx = Math.abs(event.clientX - start.x)
    const dy = Math.abs(event.clientY - start.y)
    if (dy > 12 && dy > dx) gesture.current = null
    if (dx >= 16 && dx >= dy * 1.45) {
      start.locked = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    gesture.current = null
    if (!start || start.id !== event.pointerId || !canSwipe()) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.45 || window.getSelection()?.toString()) return
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    if (dx > 0 && onHome) openProjects()
    if (dx < 0 && !onHome) back()
  }

  const voiceKeyProps = {
    disabled: Boolean(capture || reply),
    onStart: startCapture,
    onRelease: releaseCapture,
    onCancel: cancelCapture,
  }
  const quickVoice = () => {
    if (capture) return
    setCapture({ view, listening: false, transcript: '请更新一下当前进展和下一步安排。' })
  }
  const preview = capture && <VoicePreview capture={capture} onCancel={cancelCapture} onSend={sendCapture} />
  const title = view.kind === 'home' ? 'AhaStation' : view.kind === 'projects' ? '全部项目'
    : view.kind === 'task' ? task(view.id)?.name ?? '任务详情' : view.kind === 'discussion' ? project(view.id)?.name ?? '项目讨论' : '任务面板'

  return (
    <div
      className={`hhp-theme hh-portrait is-${view.kind}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => { gesture.current = null }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return
        if (capture) cancelCapture()
        else if (onHome && keyboardOpen) setKeyboardOpen(false)
        else if (!onHome) back()
        else return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <header className="hhp-topbar">
        {!onHome && <button type="button" className="hhp-icon-button" aria-label="返回" disabled={Boolean(capture)} onClick={back}><IconChevronLeft size={20} /></button>}
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        {onHome && <>
          <button type="button" className="hhp-icon-button" aria-label="连接主机" title="连接主机" disabled={Boolean(capture || reply)} onClick={() => dispatch({ type: 'set-handheld-mode', mode: 'shared' })}><IconLink size={17} /></button>
          <button type="button" className="hhp-button is-quiet hhp-project-link" disabled={Boolean(capture)} onClick={openProjects}>全部项目 <IconChevronRight size={16} /></button>
        </>}
        {view.kind === 'discussion' && <button type="button" className="hhp-button is-quiet" disabled={Boolean(capture)} onClick={() => push({ kind: 'board', id: view.id })}>任务面板 <IconChevronRight size={16} /></button>}
      </header>

      <div className="hhp-pages">
        {stack.map(({ key, view: page }) => <main className="hhp-scroll" key={key} hidden={key !== active.key}>
          {page.kind === 'home' && <>
            <section className="hhp-assistant-header" aria-label="Aha 助理汇报">
              <div className="hhp-assistant-row">
                <div className="hhp-assistant-avatar" aria-hidden="true"><PuzzleCompanion size={48} mood={capture?.listening ? 'listening' : 'present'} /></div>
                <div className="hhp-assistant-copy">
                  <h2>Aha 助理</h2>
                  <button type="button" className="hhp-brief" disabled={Boolean(capture) || (!queue.length && !reviewable.length)} onClick={() => {
                    const target = queue.length ? approvalSection.current : reviewHeading.current
                    target?.scrollIntoView({ block: 'start' })
                    target?.focus({ preventScroll: true })
                  }}>{brief}</button>
                </div>
                <VoiceKey compact {...voiceKeyProps} />
              </div>
            </section>
            <section className="hhp-assistant-card" aria-label="Aha 助理最新回复" ref={assistantRef}>
              {onHome && preview}
              <div className="hhp-latest">
                {reply?.user && <div className={`hhp-transient${reply.fading ? ' is-fading' : ''}`}>
                  <div><p className="hhp-message-bubble">{reply.user}</p></div>
                </div>}
                <p className="hhp-message-bubble hhp-latest-reply">
                  {reply ? reply.text || <span className="hhp-thinking" role="status">思考中</span> : latestReply?.text ?? postHostProgress()}
                </p>
                <button type="button" className="hhp-button is-quiet hhp-history-button" disabled={Boolean(capture)} onClick={() => setHistoryOpen(true)}><IconHistory size={15} /> 对话记录</button>
              </div>
            </section>

            <section className="hhp-home-queue" aria-labelledby="hhp-queue-title" ref={approvalSection} tabIndex={-1}>
              <div className="hhp-section-heading">
                <h2 id="hhp-queue-title">待审批任务</h2>
                <span className="hhp-muted">{queue.length} 条待审批</span>
              </div>
              {!queue.length && <p className="hhp-empty">待审批事项已处理完毕。</p>}
              {approvals.map((item) => <PortraitApproval key={item.id} approval={item} onTask={openTask} onShowApproval={showApproval} />)}
              {(queue.length > 1 || processed.length > 0) && <button type="button" className="hhp-button is-quiet hhp-expand-queue" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? '收起审批' : queue.length > 1 ? `展开其余 ${queue.length - 1} 条审批` : '查看已处理审批'}
                <IconChevronRight size={16} />
              </button>}
              {!queue.length && reviewable.length > 0 && <div className="hhp-home-deliveries">
                <h3 ref={reviewHeading} tabIndex={-1}>待验收交付</h3>
                {reviewable.map((item) => <button type="button" className="hhp-button" key={item.id} onClick={() => openTask(item.id)}>{item.name}<IconChevronRight size={16} /></button>)}
              </div>}
            </section>
          </>}
          {page.kind === 'projects' && <HandheldProjects onDiscussion={(id) => push({ kind: 'discussion', id })} onTask={openTask} />}
          {(page.kind === 'discussion' || page.kind === 'board') && (() => {
            const channelId = state.discussions.find((item) => item.projectId === page.id && !item.taskId)?.id
            return page.kind === 'discussion' ? <HandheldDiscussion projectId={page.id} onTask={openTask} onShowApproval={showApproval}
              draft={channelId ? state.drafts.discussions[channelId] ?? '' : ''}
              onDraftChange={(text) => { if (channelId) dispatch({ type: 'set-draft', channelType: 'discussion', channelId, text }) }} />
              : <HandheldBoard projectId={page.id} onTask={openTask} />
          })()}
          {page.kind === 'task' && <HandheldTask taskId={page.id} onShowApproval={showApproval} onVoice={quickVoice}
            draft={state.drafts.tasks[page.id] ?? ''}
            onDraftChange={(text) => dispatch({ type: 'set-draft', channelType: 'task', channelId: page.id, text })} />}
        </main>)}
      </div>

      {!onHome && preview}
      {onHome && <div className="hhp-home-tools" ref={toolRef}>
        <div className="hhp-quota-head">
          <span id="hhp-quota-title">模型剩余额度</span>
          <button type="button" className="hhp-icon-button" aria-label={keyboardOpen ? '收起键盘' : '展开键盘'} aria-expanded={keyboardOpen} disabled={Boolean(capture)} onClick={() => setKeyboardOpen(!keyboardOpen)}><IconKeyboard size={19} /></button>
        </div>
        <ul className="hhp-quotas" aria-labelledby="hhp-quota-title">
          {MODEL_QUOTAS.map(({ model, remaining, color }) => <li key={model}>
            <span className="hhp-quota-ring" style={{ '--quota-value': `${remaining}%`, '--quota-color': color } as CSSProperties}><strong>{remaining}%</strong></span>
            <span>{model}</span>
          </li>)}
        </ul>
        {keyboardOpen && <div className="hhp-home-keyboard">
          <PortraitComposer value={state.drafts.host} onChange={(text) => dispatch({ type: 'set-draft', channelType: 'host', channelId: 'host', text })}
            onSend={sendHome} sendDisabled={Boolean(capture || reply)} label="发消息给 Aha 助理" />
          <div className="hhp-virtual-keys" aria-label="演示键盘">
            {['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row) => <div key={row}>
              {[...row].map((letter) => <button type="button" key={letter} onClick={() => dispatch({ type: 'set-draft', channelType: 'host', channelId: 'host', text: (state.drafts.host + letter).slice(0, 600) })}>{letter}</button>)}
            </div>)}
            <div>
              <button type="button" onClick={() => dispatch({ type: 'set-draft', channelType: 'host', channelId: 'host', text: (state.drafts.host + ' ').slice(0, 600) })}>空格</button>
              <button type="button" onClick={() => dispatch({ type: 'set-draft', channelType: 'host', channelId: 'host', text: state.drafts.host.slice(0, -1) })}>删除</button>
            </div>
          </div>
        </div>}
      </div>}
      <footer className="hhp-device-footer"><VoiceKey {...voiceKeyProps} /></footer>

      {historyOpen && <PortraitDialog title="对话记录" onClose={() => setHistoryOpen(false)}>
        <div className="hhp-history-log" ref={historyLogRef}>{hostMessages.map((message) => <PortraitMessage key={message.id} message={message} />)}</div>
      </PortraitDialog>}
      {selectedApproval && <PortraitDialog title="选择审批策略" onClose={() => setApprovalId(null)}>
        <p className="hhp-muted">{selectedApproval.title}</p>
        <fieldset className="hhp-strategies">
          <legend className="hhp-visually-hidden">审批策略</legend>
          {selectedApproval.options?.map((option) => <label className="hhp-card" key={option.id}>
            <input type="radio" name="hhp-strategy" value={option.id} checked={strategy === option.id} onChange={() => setStrategy(option.id)} />
            <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
          </label>)}
        </fieldset>
        <div className="hhp-dialog-actions">
          <button type="button" className="hhp-button" onClick={() => setApprovalId(null)}>取消</button>
          <button type="button" className="hhp-button is-primary" disabled={!strategy} onClick={() => {
            dispatch({ type: 'resolve-approval', approvalId: selectedApproval.id, decision: 'approved', optionId: strategy })
            setApprovalId(null)
          }}>确认允许</button>
        </div>
      </PortraitDialog>}
    </div>
  )
}
