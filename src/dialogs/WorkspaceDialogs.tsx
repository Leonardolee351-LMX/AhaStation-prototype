import { useEffect, useRef, useState } from 'react'
import { PROVIDER_MODELS, PROVIDERS, SAMPLE_FOLDER, SAMPLE_REPO } from '../data'
import { IconClone, IconFolder, IconSpark } from '../icons'
import { formatRange, formatWait, uid, validateHostAddress } from '../lib'
import {
  SCAN_CATALOG,
  buildProject,
  makeCustomAgent,
  useWorkspace,
  validateNewProject,
  type NewProjectFields,
} from '../store'
import type { EntryMode, ProjectSource } from '../types'
import { TASK_STATUS_LABEL } from '../types'
import { ApprovalChoices, hasApprovalChoices } from '../components/ApprovalChoices'
import { LocalScanView } from '../components/LocalScanView'
import { Button, Dialog, Field, TextArea, TextInput } from '../ui'

const EMPTY_FIELDS: NewProjectFields = {
  source: 'local',
  path: '',
  repository: '',
  name: '',
  location: '~/Projects',
  entry: 'discussion',
}

export function WorkspaceDialogs() {
  const { state } = useWorkspace()
  const dialog = state.dialog
  if (!dialog) return null
  if (dialog.type === 'new-project') return <NewProjectDialog />
  if (dialog.type === 'project-picker') return <ProjectPickerDialog topic={dialog.topic} />
  if (dialog.type === 'approval') return <ApprovalDialog approvalId={dialog.approvalId} />
  if (dialog.type === 'scheme') return <SchemeDialog approvalId={dialog.approvalId} />
  if (dialog.type === 'proposal') return <ProposalDialog proposalId={dialog.proposalId} />
  if (dialog.type === 'history') return <HistoryDialog recordId={dialog.recordId} />
  if (dialog.type === 'new-agent') return <NewAgentDialog />
  if (dialog.type === 'edit-agent') return <EditAgentDialog agentId={dialog.agentId} />
  if (dialog.type === 'external-agent') return <ExternalAgentDialog />
  if (dialog.type === 'remote-host') return <RemoteHostDialog />
  if (dialog.type === 'confirm-delete-agent') return <DeleteAgentDialog agentId={dialog.agentId} />
  if (dialog.type === 'local-scan') return <LocalScanView variant="dialog" mode={dialog.mode ?? 'scan'} />
  return null
}

function NewProjectDialog() {
  const { state, dispatch } = useWorkspace()
  const dialog = state.dialog
  const lock = dialog?.type === 'new-project' ? dialog.lockEntry : false
  const topic = dialog?.type === 'new-project' ? dialog.topic : undefined
  const fromPicker = dialog?.type === 'new-project' ? dialog.fromPicker : false
  const [step, setStep] = useState<'source' | 'params'>('source')
  const [fields, setFields] = useState<NewProjectFields>({ ...EMPTY_FIELDS, entry: lock ? 'discussion' : 'discussion' })
  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const pathRef = useRef<HTMLInputElement>(null)
  const repoRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!error) return
    const map: Record<string, HTMLInputElement | null> = { path: pathRef.current, repository: repoRef.current, name: nameRef.current, location: nameRef.current }
    map[error.field]?.focus()
  }, [error])

  function patch(partial: Partial<NewProjectFields>) {
    setFields((current) => ({ ...current, ...partial }))
    setError(null)
  }

  function submit() {
    const next = { ...fields, entry: lock ? 'discussion' as EntryMode : fields.entry }
    const invalid = validateNewProject(next, state.projects)
    if (invalid) {
      setError(invalid)
      return
    }
    const project = buildProject(next)
    dispatch({ type: 'create-project', project, entry: next.entry, topic })
  }

  function close() {
    if (fromPicker) dispatch({ type: 'set-dialog', dialog: { type: 'project-picker', topic: topic ?? '' } })
    else dispatch({ type: 'set-dialog', dialog: null })
  }

  const sources: { id: ProjectSource; title: string; text: string; icon: typeof IconFolder }[] = [
    { id: 'local', title: '打开本机文件夹', text: '使用已经在本机的工作目录。', icon: IconFolder },
    { id: 'clone', title: '从 Git 或 GitHub 克隆', text: '填写仓库地址，默认放到 ~/Projects。', icon: IconClone },
    { id: 'blank', title: '新建空项目', text: '只需要一个名称，即可创建一个空目录。', icon: IconSpark },
  ]

  return (
    <Dialog open title="新建项目室" onClose={close} width="lg">
      {step === 'source' ? (
        <div className="aha-source-grid">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={`aha-choice${fields.source === source.id ? ' is-selected' : ''}`}
              onClick={() => {
                patch({ source: source.id })
                setStep('params')
              }}
            >
              <source.icon size={20} />
              <strong>{source.title}</strong>
              <span>{source.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <form
          className="aha-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          {fields.source === 'local' ? (
            <Field label="文件夹路径" error={error?.field === 'path' ? error.message : undefined}>
              <div className="aha-input-row">
                <TextInput
                  ref={pathRef}
                  value={fields.path}
                  maxLength={240}
                  placeholder="~/Projects/example 或 E:/Work/example"
                  onChange={(event) => patch({ path: event.target.value })}
                />
                <Button size="sm" onClick={() => patch({ path: SAMPLE_FOLDER })}>
                  浏览
                </Button>
              </div>
            </Field>
          ) : null}
          {fields.source === 'clone' ? (
            <Field label="仓库地址" hint="支持 owner/repo、HTTP(S) 或 SSH。" error={error?.field === 'repository' ? error.message : undefined}>
              <div className="aha-input-row">
                <TextInput
                  ref={repoRef}
                  value={fields.repository}
                  maxLength={240}
                  placeholder="owner/repo"
                  onChange={(event) => patch({ repository: event.target.value })}
                />
                <Button size="sm" onClick={() => patch({ repository: SAMPLE_REPO })}>
                  示例
                </Button>
              </div>
            </Field>
          ) : null}
          {fields.source === 'blank' ? (
            <>
              <Field label="项目名称" error={error?.field === 'name' ? error.message : undefined}>
                <TextInput ref={nameRef} value={fields.name} maxLength={36} onChange={(event) => patch({ name: event.target.value })} />
              </Field>
              <Field label="位置（选填）" error={error?.field === 'location' ? error.message : undefined}>
                <TextInput value={fields.location} maxLength={200} onChange={(event) => patch({ location: event.target.value })} />
              </Field>
            </>
          ) : null}
          <fieldset className="aha-fieldset">
            <legend className="aha-fieldset-legend">进入方式</legend>
            <label className="aha-radio">
              <input type="radio" name="entry" checked={fields.entry === 'discussion' || Boolean(lock)} disabled={lock} onChange={() => patch({ entry: 'discussion' })} />
              开启讨论
            </label>
            <label className="aha-radio">
              <input type="radio" name="entry" checked={fields.entry === 'cli' && !lock} disabled={lock} onChange={() => patch({ entry: 'cli' })} />
              只开 CLI 工作区
            </label>
            {lock ? <p className="aha-muted">从讨论选择器进入时，将使用原始话题开启讨论。</p> : null}
          </fieldset>
          <div className="aha-dialog-actions">
            <Button onClick={() => setStep('source')}>返回</Button>
            <Button variant="primary" type="submit">
              {fields.source === 'local' ? '打开项目' : fields.source === 'clone' ? '克隆项目' : '创建项目'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function ProjectPickerDialog({ topic }: { topic: string }) {
  const { state, dispatch, openOrStartProjectDiscussion } = useWorkspace()
  return (
    <Dialog open title="选择讨论项目" onClose={() => dispatch({ type: 'set-dialog', dialog: null })}>
      <p className="aha-dialog-copy">将把这句话带入讨论：{topic}</p>
      <ul className="aha-picker-list">
        {state.projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'set-dialog', dialog: null })
                openOrStartProjectDiscussion(project.id, { topic })
              }}
            >
              <strong>{project.name}</strong>
              <span>{project.path}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="aha-dialog-actions">
        <Button
          variant="primary"
          onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-project', lockEntry: true, topic, fromPicker: true } })}
        >
          新建项目并讨论
        </Button>
      </div>
    </Dialog>
  )
}

function ApprovalDialog({ approvalId }: { approvalId: string }) {
  const { state, dispatch } = useWorkspace()
  const approval = state.approvals.find((item) => item.id === approvalId)
  if (!approval) return null
  const later = () => dispatch({ type: 'set-dialog', dialog: null })
  const choices = hasApprovalChoices(approval)
  return (
    <Dialog open title={approval.title} onClose={later} showClose={false}>
      <p className="aha-dialog-copy">{approval.detail}</p>
      {approval.effect ? <p className="aha-muted">{choices ? '选定后：' : '允许后：'}{approval.effect}</p> : null}
      {approval.impact ? <p className="aha-muted">影响：{approval.impact}</p> : null}
      {choices ? <ApprovalChoices approval={approval} /> : null}
      <p className="aha-muted">{formatWait(approval.requestedAt)}</p>
      <div className="aha-dialog-actions">
        <Button onClick={later}>稍后决策</Button>
        {choices ? null : (
          <>
            <Button variant="ghost" onClick={() => dispatch({ type: 'resolve-approval', approvalId, decision: 'rejected' })}>
              拒绝
            </Button>
            <Button variant="primary" onClick={() => dispatch({ type: 'resolve-approval', approvalId, decision: 'approved' })}>
              允许
            </Button>
          </>
        )}
      </div>
    </Dialog>
  )
}

function SchemeDialog({ approvalId }: { approvalId: string }) {
  const { state, dispatch } = useWorkspace()
  const approval = state.approvals.find((item) => item.id === approvalId)
  if (!approval) return null
  const later = () => dispatch({ type: 'set-dialog', dialog: null })
  return (
    <Dialog open title={approval.title} onClose={later} showClose={false}>
      <p className="aha-dialog-copy">{approval.detail || `请选择「${approval.title}」的方案。`}</p>
      <ApprovalChoices approval={approval} />
      <div className="aha-dialog-actions">
        <Button onClick={later}>稍后决策</Button>
      </div>
    </Dialog>
  )
}

function ProposalDialog({ proposalId }: { proposalId: string }) {
  const { state, dispatch, project, task, agent } = useWorkspace()
  const proposal = state.proposals.find((item) => item.id === proposalId)
  if (!proposal) return null
  const existing = proposal.taskId ? task(proposal.taskId) : undefined
  return (
    <Dialog open title={proposal.newTask ? '新建任务提议' : '修改任务提议'} onClose={() => dispatch({ type: 'set-dialog', dialog: null })} width="lg">
      <dl className="aha-meta">
        <div>
          <dt>项目</dt>
          <dd>{project(proposal.projectId)?.name}</dd>
        </div>
        {existing ? (
          <div>
            <dt>任务</dt>
            <dd>{existing.name}</dd>
          </div>
        ) : (
          <div>
            <dt>拟定任务</dt>
            <dd>{proposal.draftName}</dd>
          </div>
        )}
        {proposal.oldGoal ? (
          <div>
            <dt>原目标</dt>
            <dd>{proposal.oldGoal}</dd>
          </div>
        ) : null}
        <div>
          <dt>目标</dt>
          <dd>{proposal.goal}</dd>
        </div>
        <div>
          <dt>验收要求</dt>
          <dd>{proposal.acceptance}</dd>
        </div>
        <div>
          <dt>负责人</dt>
          <dd>{agent(proposal.ownerAgentId)?.name}</dd>
        </div>
      </dl>
      <div className="aha-dialog-actions">
        <Button onClick={() => dispatch({ type: 'set-dialog', dialog: null })}>返回提议卡</Button>
        <Button variant="ghost" onClick={() => dispatch({ type: 'resolve-proposal', proposalId, decision: 'discarded' })}>
          拒绝
        </Button>
        <Button variant="primary" onClick={() => dispatch({ type: 'resolve-proposal', proposalId, decision: 'confirmed' })}>
          允许
        </Button>
      </div>
    </Dialog>
  )
}

function HistoryDialog({ recordId }: { recordId: string }) {
  const { state, dispatch, project, task, openTask, openDiscussion } = useWorkspace()
  const record = state.history.find((item) => item.id === recordId)
  if (!record) return null
  const live = record.liveDiscussionId ? state.discussions.find((item) => item.id === record.liveDiscussionId) : undefined
  const continuation = record.continuationId ? state.discussions.find((item) => item.id === record.continuationId) : undefined
  const previous = record.previousRecordId ? state.history.find((item) => item.id === record.previousRecordId) : undefined

  return (
    <Dialog open title={record.title} onClose={() => dispatch({ type: 'set-dialog', dialog: null })} width="lg">
      <p className="aha-kicker">
        {project(record.projectId)?.name} · {formatRange(record.startedAt, record.endedAt)}
      </p>
      <dl className="aha-meta">
        <div>
          <dt>目标</dt>
          <dd>{record.goal}</dd>
        </div>
        {record.conclusion ? (
          <div>
            <dt>结论</dt>
            <dd>{record.conclusion}</dd>
          </div>
        ) : null}
        {previous ? (
          <div>
            <dt>接续来源</dt>
            <dd>{previous.title}</dd>
          </div>
        ) : null}
      </dl>
      <h3 className="aha-subhead">参与者</h3>
      <p>{record.participants.map((item) => item.name).join('、')}</p>
      <h3 className="aha-subhead">对话历史</h3>
      {record.transcriptTruncated ? <p className="aha-muted">仅显示可见范围内的片段。</p> : null}
      <ul className="aha-transcript">
        {record.transcript.map((line, index) => (
          <li key={index}>
            <strong>{line.name}</strong>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      <h3 className="aha-subhead">关联任务</h3>
      <ul className="aha-related-tasks">
        {record.relatedTaskIds.map((id) => {
          const item = task(id)
          const outcome = record.outcomes.find((row) => row.taskId === id)
          if (!item) {
            return (
              <li key={id} className="aha-muted">
                {outcome?.title ?? '历史任务'} · 当前状态暂无法查看
              </li>
            )
          }
          const pending = state.approvals.some((row) => row.taskId === item.id && row.status === 'pending')
          return (
            <li key={id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {outcome ? (outcome.type === 'created' ? '新建' : '修改') : '关联'} · {TASK_STATUS_LABEL[item.status]}
                  {pending ? ' · 待审批' : ''}
                </span>
                <span className="aha-muted">{item.latestUpdate}</span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  dispatch({ type: 'set-dialog', dialog: null })
                  openTask(item.id)
                }}
              >
                查看任务详情
              </Button>
            </li>
          )
        })}
      </ul>
      <div className="aha-dialog-actions">
        <Button
          variant="primary"
          onClick={() => {
            if (live) {
              dispatch({ type: 'set-dialog', dialog: null })
              openDiscussion(live.id)
              return
            }
            if (continuation) {
              dispatch({ type: 'set-dialog', dialog: null })
              openDiscussion(continuation.id)
              return
            }
            dispatch({ type: 'continue-history', recordId: record.id, mode: 'reopen' })
          }}
        >
          {live ? '继续讨论' : '重新开启讨论'}
        </Button>
      </div>
    </Dialog>
  )
}

function NewAgentDialog() {
  const { dispatch } = useWorkspace()
  const [mode, setMode] = useState<'pick' | 'manual'>('pick')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>('Anthropic')
  const [model, setModel] = useState((PROVIDER_MODELS.Anthropic ?? ['Claude Sonnet'])[0])
  const [error, setError] = useState<string | null>(null)
  const { state } = useWorkspace()
  const models = PROVIDER_MODELS[provider] ?? ['默认模型']
  return (
    <Dialog open title="新建智能体" onClose={() => dispatch({ type: 'set-dialog', dialog: null })} width="lg">
      {mode === 'pick' ? (
        <div className="aha-source-grid">
          <button type="button" className="aha-choice" onClick={() => setMode('manual')}>
            <strong>手动创建</strong>
            <span>填写名称与描述，生成工作区内的助理。</span>
          </button>
          <button type="button" className="aha-choice" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'external-agent', step: 1 } })}>
            <strong>接入外部智能体</strong>
            <span>从已连接主机扫描并接入。</span>
          </button>
        </div>
      ) : (
        <form
          className="aha-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return setError('请填写名称。')
            if (name.trim().length > 36) return setError('名称最多 36 个字符。')
            if (!description.trim()) return setError('请填写描述。')
            if (description.trim().length > 220) return setError('描述最多 220 个字符。')
            dispatch({
              type: 'create-agent',
              agent: makeCustomAgent(name, description, state.agents.map((item) => item.slug), { aiProvider: provider, aiModel: model }),
            })
          }}
        >
          <Field label="名称" error={error && !description ? error : undefined}>
            <TextInput value={name} maxLength={36} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="描述" error={error && description !== undefined ? error : undefined}>
            <TextArea value={description} maxLength={220} rows={4} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <div className="aha-form-split">
            <Field label="服务商">
              <select
                className="aha-input"
                value={provider}
                onChange={(event) => {
                  const next = event.target.value as (typeof PROVIDERS)[number]
                  setProvider(next)
                  setModel((PROVIDER_MODELS[next] ?? ['默认模型'])[0])
                }}
              >
                {PROVIDERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="模型">
              <select className="aha-input" value={model} onChange={(event) => setModel(event.target.value)}>
                {models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="aha-muted">API Key 请到设置里的「AI 后端」统一管理，不会在创建时单独填写。</p>
          <div className="aha-dialog-actions">
            <Button onClick={() => setMode('pick')}>返回</Button>
            <Button variant="primary" type="submit">
              创建
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function EditAgentDialog({ agentId }: { agentId: string }) {
  const { state, dispatch } = useWorkspace()
  const agent = state.agents.find((item) => item.id === agentId)
  const [name, setName] = useState(agent?.name ?? '')
  const [slug, setSlug] = useState(agent?.slug ?? '')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [role, setRole] = useState(agent?.role ?? '')
  const [provider, setProvider] = useState(agent?.aiProvider ?? 'Anthropic')
  const [model, setModel] = useState(agent?.aiModel ?? 'Claude Sonnet')
  const [reasoning, setReasoning] = useState(agent?.reasoning ?? 'medium')
  const [more, setMore] = useState(false)
  if (!agent) return null
  const models = PROVIDER_MODELS[provider] ?? ['默认模型']
  return (
    <Dialog open title={`编辑 ${agent.name}`} onClose={() => dispatch({ type: 'set-dialog', dialog: null })} width="lg">
      <form
        className="aha-form"
        onSubmit={(event) => {
          event.preventDefault()
          dispatch({
            type: 'update-agent',
            agentId,
            patch: { name, slug, description, role, aiProvider: provider, aiModel: model, reasoning },
          })
        }}
      >
        <Field label="名称">
          <TextInput value={name} maxLength={36} onChange={(event) => setName(event.target.value)} />
        </Field>
        <p className="aha-muted">{description || '还没有描述。'}</p>
        <Field label="描述">
          <TextArea value={description} maxLength={220} rows={3} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="@标识">
          <TextInput value={slug} onChange={(event) => setSlug(event.target.value)} />
        </Field>
        <Field label="服务商">
          <select
            className="aha-input"
            value={provider}
            onChange={(event) => {
              const next = event.target.value
              setProvider(next)
              setModel((PROVIDER_MODELS[next] ?? ['默认模型'])[0])
            }}
          >
            {PROVIDERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="模型">
          <select className="aha-input" value={model} onChange={(event) => setModel(event.target.value)}>
            {models.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="推理强度">
          <select className="aha-input" value={reasoning} onChange={(event) => setReasoning(event.target.value as typeof reasoning)}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </Field>
        <p className="aha-muted">工具与技能：{(agent.tools ?? []).concat(agent.skills).join('、') || '未配置'}</p>
        <Button size="sm" variant="ghost" onClick={() => setMore((value) => !value)}>
          {more ? '收起更多资料' : '更多资料'}
        </Button>
        {more ? (
          <Field label="角色">
            <TextInput value={role} onChange={(event) => setRole(event.target.value)} />
          </Field>
        ) : null}
        <div className="aha-dialog-actions">
          <Button onClick={() => dispatch({ type: 'set-dialog', dialog: null })}>取消</Button>
          <Button variant="primary" type="submit">
            保存
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ExternalAgentDialog() {
  const { state, dispatch } = useWorkspace()
  const dialog = state.dialog
  if (dialog?.type !== 'external-agent') return null
  const step = dialog.step
  const hostId = dialog.hostId
  const selected = dialog.selected ?? []
  const drafts = dialog.drafts ?? {}
  const items = SCAN_CATALOG.filter((item) => item.hostId === hostId)
  return (
    <Dialog open title="接入外部智能体" onClose={() => dispatch({ type: 'set-dialog', dialog: null })} width="lg">
      {step === 1 ? (
        <div className="aha-form">
          <p className="aha-dialog-copy">请先选择一台已连接主机。更换主机会清空本次扫描结果。</p>
          <ul className="aha-picker-list">
            {state.hosts.map((host) => (
              <li key={host.id}>
                <button
                  type="button"
                  className={hostId === host.id ? 'is-selected' : ''}
                  onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'external-agent', step: 1, hostId: host.id, selected: [], drafts: {} } })}
                >
                  <strong>{host.name}</strong>
                  <span>{host.hostAddress}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="aha-dialog-actions">
            <Button onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-agent' } })}>返回</Button>
            <Button variant="primary" disabled={!hostId} onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'external-agent', step: 2, hostId, selected: [], drafts: {} } })}>
              扫描
            </Button>
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="aha-form">
          <p className="aha-dialog-copy">已扫描到可接入的外部助理。未安装或已接入的条目不可选。</p>
          <ul className="aha-scan-list">
            {items.map((item) => {
              const disabled = item.status !== 'available'
              const checked = selected.includes(item.id)
              return (
                <li key={item.id}>
                  <label className={disabled ? 'is-disabled' : ''}>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={checked}
                      onChange={() => {
                        const next = checked ? selected.filter((id) => id !== item.id) : [...selected, item.id]
                        dispatch({ type: 'set-dialog', dialog: { ...dialog, selected: next } })
                      }}
                    />
                    <strong>{item.name}</strong>
                    <span>
                      {item.version} · {item.status === 'missing' ? '未安装' : item.status === 'connected' ? '已接入' : '可接入'}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="aha-dialog-actions">
            <Button onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'external-agent', step: 1, hostId } })}>返回</Button>
            <Button onClick={() => dispatch({ type: 'toast', message: '已重新扫描，结果保持示例状态。' })}>重新扫描</Button>
            <Button
              variant="primary"
              disabled={selected.length === 0}
              onClick={() => {
                const nextDrafts: Record<string, { name: string; description: string }> = {}
                selected.forEach((id) => {
                  const item = items.find((row) => row.id === id)
                  nextDrafts[id] = drafts[id] ?? { name: item?.name ?? '', description: '' }
                })
                dispatch({ type: 'set-dialog', dialog: { type: 'external-agent', step: 3, hostId, selected, drafts: nextDrafts } })
              }}
            >
              下一步
            </Button>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <form
          className="aha-form"
          onSubmit={(event) => {
            event.preventDefault()
            for (const id of selected) {
              const item = items.find((row) => row.id === id)
              const draft = drafts[id]
              if (!draft?.name.trim() || draft.name.trim().length > 36) {
                dispatch({ type: 'toast', message: '请为每个助理填写不超过 36 字的名称。' })
                return
              }
              if (draft.description.length > 240) {
                dispatch({ type: 'toast', message: '描述最多 240 个字符。' })
                return
              }
              dispatch({
                type: 'create-agent',
                agent: {
                  ...makeCustomAgent(draft.name, draft.description || `${item?.name} 外部接入`, state.agents.map((row) => row.slug)),
                  source: 'external',
                  deviceId: hostId,
                  externalProvider: item?.externalProvider,
                  version: item?.version,
                },
              })
            }
            dispatch({ type: 'toast', message: '外部智能体已接入。' })
            dispatch({ type: 'set-dialog', dialog: null })
            dispatch({ type: 'set-settings-group', group: 'agents' })
          }}
        >
          {selected.map((id) => {
            const item = items.find((row) => row.id === id)
            const draft = drafts[id] ?? { name: '', description: '' }
            const host = state.hosts.find((row) => row.id === hostId)
            return (
              <fieldset key={id} className="aha-fieldset">
                <legend className="aha-fieldset-legend">{item?.name}</legend>
                <p className="aha-muted">
                  {host?.name} · {item?.version}
                </p>
                <Field label="名称">
                  <TextInput
                    value={draft.name}
                    maxLength={36}
                    onChange={(event) =>
                      dispatch({
                        type: 'set-dialog',
                        dialog: { ...dialog, drafts: { ...drafts, [id]: { ...draft, name: event.target.value } } },
                      })
                    }
                  />
                </Field>
                <Field label="描述（选填）">
                  <TextArea
                    value={draft.description}
                    maxLength={240}
                    rows={3}
                    onChange={(event) =>
                      dispatch({
                        type: 'set-dialog',
                        dialog: { ...dialog, drafts: { ...drafts, [id]: { ...draft, description: event.target.value } } },
                      })
                    }
                  />
                </Field>
              </fieldset>
            )
          })}
          <div className="aha-dialog-actions">
            <Button onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'external-agent', step: 2, hostId, selected, drafts } })}>
              返回
            </Button>
            <Button variant="primary" type="submit">
              接入
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  )
}

function RemoteHostDialog() {
  const { state, dispatch } = useWorkspace()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  return (
    <Dialog open title="添加远程主机" onClose={() => dispatch({ type: 'set-dialog', dialog: null })}>
      <form
        className="aha-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return setError('请填写主机名称。')
          if (name.trim().length > 40) return setError('名称最多 40 个字符。')
          if (state.hosts.some((item) => item.name === name.trim())) return setError('已有同名主机。')
          const addressError = validateHostAddress(address)
          if (addressError) return setError(addressError)
          if (state.hosts.some((item) => item.hostAddress === address.trim())) return setError('这个地址已经添加过了。')
          setChecking(true)
          window.setTimeout(() => {
            dispatch({
              type: 'add-host',
              host: {
                id: uid('host'),
                name: name.trim(),
                hostAddress: address.trim(),
                connectionState: 'simulated',
                remoteReconnect: true,
              },
            })
            setChecking(false)
          }, 400)
        }}
      >
        <Field label="主机名称" error={error && error.includes('名称') ? error : undefined}>
          <TextInput value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="连接地址" error={error && !error.includes('名称') ? error : undefined}>
          <TextInput value={address} maxLength={240} placeholder="https://10.0.0.8:7420" onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <div className="aha-dialog-actions">
          <Button onClick={() => dispatch({ type: 'set-dialog', dialog: null })}>取消</Button>
          <Button variant="primary" type="submit" disabled={checking}>
            {checking ? '正在校验…' : '校验并添加'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteAgentDialog({ agentId }: { agentId: string }) {
  const { state, dispatch } = useWorkspace()
  const agent = state.agents.find((item) => item.id === agentId)
  return (
    <Dialog open title="删除助理" onClose={() => dispatch({ type: 'set-dialog', dialog: null })} width="sm">
      <p className="aha-dialog-copy">确定删除「{agent?.name}」吗？历史记录和任务记录会保留。</p>
      <div className="aha-dialog-actions">
        <Button onClick={() => dispatch({ type: 'set-dialog', dialog: null })}>取消</Button>
        <Button variant="danger" onClick={() => dispatch({ type: 'delete-agent', agentId })}>
          删除
        </Button>
      </div>
    </Dialog>
  )
}
