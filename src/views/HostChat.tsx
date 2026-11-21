import { useEffect, useRef } from 'react'
import { ChatSurfaceSwitch, SessionTerminal, chatSurfaceOf } from '../components/ChatSurfaceSwitch'
import { Composer } from '../components/Composer'
import { ReviewQueueButton } from '../components/ReviewQueue'
import { ViewTitle } from '../components/SurfaceLogo'
import { formatTime } from '../lib'
import { useWorkspace } from '../store'
import { Avatar, Button } from '../ui'

export function HostChat() {
  const { state, agent, dispatch, postHostProgress } = useWorkspace()
  const log = useRef<HTMLDivElement>(null)
  const messages = state.messages.filter((message) => message.channelType === 'host')
  const surface = chatSurfaceOf(state.prefs.chatSurfaces, 'host:host')
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, surface])

  const askProgress = () => {
    dispatch({ type: 'send-message', channelType: 'host', channelId: 'host', text: '先帮我汇总一下现在的进展。' })
    window.setTimeout(() => dispatch({ type: 'host-reply', text: postHostProgress() }), 400)
  }

  return (
    <section className="aha-page aha-session">
      <header className="aha-session-head">
        <ViewTitle kind="host" kicker="日常沟通" title="Aha Host">
          <p className="aha-lead">询问进展，或明确发起一个项目讨论。</p>
        </ViewTitle>
        <div className="aha-session-tools">
          <ReviewQueueButton />
          <ChatSurfaceSwitch surfaceId="host:host" />
        </div>
      </header>
      {surface === 'terminal' ? (
        <SessionTerminal
          lines={messages.map((message) => {
            const person = agent(message.authorId)
            return {
              id: message.id,
              who: person?.name ?? (message.role === 'you' ? '你' : 'Host'),
              text: message.interrupted ? `${message.text}  [已打断]` : message.text,
              time: formatTime(message.createdAt),
              tone: message.role === 'you' ? 'you' : message.role === 'system' ? 'system' : 'agent',
            }
          })}
        />
      ) : (
        <div className="aha-session-log" ref={log}>
          {messages.map((message) => {
            const person = agent(message.authorId)
            return (
              <article key={message.id} className={`aha-msg${message.role === 'you' ? ' aha-msg--you' : ''}`}>
                {person ? <Avatar agent={person} size="sm" /> : null}
                <div>
                  <p className="aha-msg-who">
                    {person?.name}
                    {message.interrupted ? <span className="aha-interrupted">已打断</span> : null}
                    <time className="aha-msg-time">{formatTime(message.createdAt)}</time>
                  </p>
                  <p className="aha-msg-body">{message.text}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <div className="aha-host-shortcuts">
        <Button size="sm" onClick={askProgress}>
          询问进展
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'project-picker', topic: '我想就当前工作发起一次讨论。' } })}
        >
          发起讨论
        </Button>
      </div>
      <Composer channelType="host" channelId="host" placeholder="和 Aha 说一句话…" />
    </section>
  )
}
