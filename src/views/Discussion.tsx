import { useEffect, useRef, useState } from 'react'
import { Composer } from '../components/Composer'
import { IconAt } from '../icons'
import { formatTime, uid } from '../lib'
import { useWorkspace } from '../store'
import type { Proposal } from '../types'
import { ViewTitle } from '../components/SurfaceLogo'
import { Avatar, Badge, Button } from '../ui'

export function DiscussionView({ discussionId }: { discussionId: string }) {
  const { state, dispatch, agent, project, openSettings } = useWorkspace()
  const discussion = state.discussions.find((item) => item.id === discussionId)
  const log = useRef<HTMLDivElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [state.messages, discussionId])
  if (!discussion) return <div className="aha-empty">找不到这场讨论。</div>
  const proj = project(discussion.projectId)
  const people = discussion.participantIds.map((id) => agent(id)).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const messages = state.messages.filter((message) => message.channelType === 'discussion' && message.channelId === discussion.id)
  const pending = state.proposals.find((item) => item.discussionId === discussion.id && item.status === 'pending')

  return (
    <section className="aha-page aha-session">
      <header className="aha-session-head">
        <ViewTitle
          kind="project"
          kicker={`${proj?.name ?? '项目'}${discussion.taskId ? ' · 任务讨论' : ' · 项目讨论'}`}
          title={discussion.title}
        >
          <ul className="aha-people">
            {people.map((person) => (
              <li key={person.id}>
                <Avatar agent={person} size="sm" />
                <span>{person.name}</span>
              </li>
            ))}
          </ul>
        </ViewTitle>
        <div className="aha-session-actions">
          <Button size="sm" onClick={() => openSettings('agents', discussion.id)}>
            ＋邀请
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (pending) {
                dispatch({ type: 'toast', message: '请先处理当前这条待确认提议。' })
                return
              }
              const proposal: Proposal = {
                id: uid('prop'),
                discussionId: discussion.id,
                projectId: discussion.projectId,
                taskId: discussion.relatedTaskIds[0],
                newTask: !discussion.taskId,
                draftName: discussion.taskId ? undefined : '整理讨论后的下一步',
                ownerAgentId: discussion.participantIds.find((id) => id !== 'you' && id !== 'host') ?? 'host',
                oldGoal: discussion.taskId ? state.tasks.find((task) => task.id === discussion.taskId)?.goal : undefined,
                goal: discussion.goal || '把刚才达成的共识写成可执行任务。',
                acceptance: '目标可执行，验收要求明确，并已指定负责人。',
                status: 'pending',
              }
              dispatch({
                type: 'add-proposal',
                proposal,
                note: '我根据刚才的讨论整理了一条提议，请查看后决定是否派发。',
              })
            }}
          >
            请 Aha 整理修改提议
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMentionOpen((value) => !value)}>
            <IconAt size={14} />
            点名发言
          </Button>
        </div>
        {mentionOpen ? (
          <ul className="aha-mention">
            {people
              .filter((person) => person.id !== 'you')
              .map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'mention', discussionId: discussion.id, agentId: person.id })
                      setMentionOpen(false)
                    }}
                  >
                    @{person.slug} {person.name}
                    {discussion.mentionedIds.includes(person.id) ? <Badge tone="success">已点名</Badge> : null}
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
      </header>
      <div className="aha-session-log" ref={log}>
        {messages.map((message) => {
          const person = agent(message.authorId)
          const proposal = message.proposalId ? state.proposals.find((item) => item.id === message.proposalId) : undefined
          return (
            <article key={message.id} className={`aha-msg${message.role === 'you' ? ' aha-msg--you' : ''}`}>
              {person ? <Avatar agent={person} size="sm" /> : null}
              <div>
                <p className="aha-msg-who">
                  {person?.name}
                  <time className="aha-msg-time">{formatTime(message.createdAt)}</time>
                </p>
                <p className="aha-msg-body">{message.text}</p>
                {proposal ? <ProposalCard proposal={proposal} /> : null}
              </div>
            </article>
          )
        })}
      </div>
      <Composer channelType="discussion" channelId={discussion.id} projectId={discussion.projectId} placeholder="参与讨论…" />
    </section>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
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
          <Button size="sm" variant="ghost" className="aha-linkish" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'proposal', proposalId: proposal.id } })}>
            查看
          </Button>
        </div>
      ) : null}
    </article>
  )
}
