import { useMemo, useState } from 'react'
import { INITIAL_IDES, INITIAL_MEMORIES, PROVIDER_MODELS, SKILL_CATALOG } from '../data'
import { IconEye, IconEyeOff, IconPin, IconPlus } from '../icons'
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, resolveSettingsSection, type SettingsSectionId } from '../settings-sections'
import { SCAN_CATALOG, useWorkspace } from '../store'
import { uid } from '../lib'
import type { Agent, McpTransport } from '../types'
import { openHandheldWindow } from '../handheld/HandheldDock'
import { TaskProcess, eventsForTask } from '../components/TaskProcess'
import { Avatar, Badge, Button, Field, Switch, TextInput } from '../ui'

export function SettingsView() {
  const { state, dispatch } = useWorkspace()
  const active = resolveSettingsSection(state.settingsGroup)
  const section = SETTINGS_SECTIONS.find((item) => item.id === active) ?? SETTINGS_SECTIONS[0]
  return (
    <section className="aha-page aha-settings">
      <div className="aha-settings-layout">
        <nav className="aha-settings-nav" aria-label="设置分区">
          {SETTINGS_GROUPS.map((group) => (
            <div className="aha-settings-nav-group" key={group.label}>
              <div className="aha-settings-nav-label">{group.label}</div>
              {group.sections.map((item) => {
                const Icon = item.icon
                const current = item.id === active
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`aha-settings-nav-item${current ? ' is-active' : ''}`}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => dispatch({ type: 'set-settings-group', group: item.id })}
                  >
                    <Icon size={15} />
                    <span>{item.title}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="aha-settings-pane">
          <header className="aha-settings-section-head">
            <h1>{section.title}</h1>
            <p>{section.description}</p>
          </header>
          <div className="aha-settings-section">{renderSection(active)}</div>
        </div>
      </div>
    </section>
  )
}

function renderSection(id: SettingsSectionId) {
  if (id === 'backends') return <BackendsSection />
  if (id === 'ahatalk') return <AhaTalkSection />
  if (id === 'speech') return <SpeechSection />
  if (id === 'ide') return <IdeSection />
  if (id === 'skills') return <SkillsSection />
  if (id === 'mcp') return <McpSection />
  if (id === 'memory') return <MemorySection />
  if (id === 'voicelock') return <VoiceLockSection />
  if (id === 'collab') return <CollabSection />
  if (id === 'upcoming') return <UpcomingSection />
  return <GeneralSection />
}

function BackendsSection() {
  return (
    <div className="aha-settings-stack">
      <h2 className="aha-settings-subhead">各家大模型 API</h2>
      <ProvidersGroup />
      <h2 className="aha-settings-subhead">Host 和 Worker 用谁</h2>
      <AgentsGroup />
    </div>
  )
}

function AhaTalkSection() {
  const { state, dispatch } = useWorkspace()
  const paths = [
    { id: 'local' as const, title: '本地', hint: '在本机识别和整理，内容不上传', ready: true },
    { id: 'key' as const, title: '自有 Key', hint: '直连你自己的模型服务', ready: false },
    { id: 'cloud' as const, title: 'AhaTalk Cloud', hint: '交给 AhaTalk 托管处理', ready: false },
  ]
  return (
    <div className="aha-settings-stack">
      <h2 className="aha-settings-subhead">处理路径</h2>
      <div className="aha-settings-choice" role="radiogroup" aria-label="AhaTalk 处理路径">
        {paths.map((path) => {
          const active = state.prefs.ahaTalkPath === path.id
          return (
            <button
              key={path.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={!path.ready}
              disabled={!path.ready}
              className={`aha-settings-choice-item${active ? ' is-active' : ''}${path.ready ? '' : ' is-disabled'}`}
              onClick={() => path.ready && dispatch({ type: 'set-prefs', patch: { ahaTalkPath: path.id } })}
            >
              <span className="aha-settings-choice-title">{path.title}</span>
              <span className="aha-settings-choice-hint">{path.hint}</span>
              {!path.ready ? <span className="aha-settings-choice-tag">开发中</span> : null}
            </button>
          )
        })}
      </div>
      <h2 className="aha-settings-subhead">识别与整理</h2>
      <VoiceGroup />
      <Switch
        checked={state.prefs.voicePolish}
        onChange={(value) => dispatch({ type: 'set-prefs', patch: { voicePolish: value } })}
        label="整理口语，去掉重复和填充词"
      />
    </div>
  )
}

function SpeechSection() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-settings-stack">
      <div className="aha-form">
        <Field label="播报音色">
          <select
            className="aha-input"
            value={state.prefs.speechVoice}
            onChange={(event) =>
              dispatch({ type: 'set-prefs', patch: { speechVoice: event.target.value as 'default' | 'soft' | 'firm' } })
            }
          >
            <option value="default">默认</option>
            <option value="soft">柔和</option>
            <option value="firm">清晰有力</option>
          </select>
        </Field>
        <Field label="播报哪些内容">
          <select
            className="aha-input"
            value={state.prefs.speechFilter}
            onChange={(event) =>
              dispatch({
                type: 'set-prefs',
                patch: { speechFilter: event.target.value as 'all' | 'replies' | 'decisions' },
              })
            }
          >
            <option value="all">全部回复</option>
            <option value="replies">只播对你说的话</option>
            <option value="decisions">只播需要决定的事项</option>
          </select>
        </Field>
      </div>
      <Switch
        checked={state.prefs.reportMode}
        onChange={(value) => dispatch({ type: 'set-prefs', patch: { reportMode: value } })}
        label="长回复先念摘要，再按需要展开全文"
      />
    </div>
  )
}

function IdeSection() {
  const { state, dispatch } = useWorkspace()
  const current = INITIAL_IDES.find((ide) => ide.id === state.prefs.defaultIde && ide.installed)
  return (
    <div className="aha-settings-stack">
      {current ? (
        <div className="aha-ide-current">
          <p className="aha-settings-subhead">当前默认 IDE</p>
          <div className="aha-ide-card is-default">
            <div>
              <strong>{current.name}</strong>
              <p className="aha-muted">{current.description}</p>
            </div>
            <Badge tone="success">默认</Badge>
          </div>
        </div>
      ) : null}
      <h2 className="aha-settings-subhead">已安装</h2>
      <ul className="aha-ide-list">
        {INITIAL_IDES.filter((ide) => ide.installed).map((ide) => (
          <li key={ide.id} className={`aha-ide-card${state.prefs.defaultIde === ide.id ? ' is-default' : ''}`}>
            <div>
              <strong>{ide.name}</strong>
              <p className="aha-muted">{ide.description}</p>
            </div>
            {state.prefs.defaultIde === ide.id ? (
              <Badge tone="success">默认</Badge>
            ) : (
              <Button size="sm" onClick={() => dispatch({ type: 'set-prefs', patch: { defaultIde: ide.id } })}>
                设为默认
              </Button>
            )}
          </li>
        ))}
      </ul>
      <h2 className="aha-settings-subhead">即将支持</h2>
      <ul className="aha-ide-list">
        {INITIAL_IDES.filter((ide) => !ide.installed).map((ide) => (
          <li key={ide.id} className="aha-ide-card is-soon">
            <div>
              <strong>{ide.name}</strong>
              <p className="aha-muted">{ide.description}</p>
            </div>
            <span className="aha-dev-tag">即将支持</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SkillsSection() {
  const [enabled, setEnabled] = useState(() => Object.fromEntries(SKILL_CATALOG.map((item) => [item.id, item.enabled])))
  const { dispatch } = useWorkspace()
  return (
    <div className="aha-settings-stack">
      <p className="aha-muted">这些技能可供 Host 和 Worker 调用。关闭后不会出现在新的任务派发里。</p>
      <ul className="aha-skill-list">
        {SKILL_CATALOG.map((skill) => (
          <li key={skill.id} className="aha-skill-card">
            <div>
              <strong>{skill.name}</strong>
              <p className="aha-muted">{skill.description}</p>
            </div>
            <Switch
              checked={Boolean(enabled[skill.id])}
              onChange={(value) => {
                setEnabled((prev) => ({ ...prev, [skill.id]: value }))
                dispatch({ type: 'toast', message: value ? `已启用「${skill.name}」` : `已停用「${skill.name}」` })
              }}
              label={enabled[skill.id] ? '已启用' : '已停用'}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function MemorySection() {
  const [items, setItems] = useState(INITIAL_MEMORIES)
  const { dispatch } = useWorkspace()
  return (
    <div className="aha-settings-stack">
      <div className="aha-view-actions">
        <p className="aha-muted">Host 会记住项目里已经确认过的偏好，可按条或全部清理。</p>
        <Button
          size="sm"
          disabled={items.length === 0}
          onClick={() => {
            setItems([])
            dispatch({ type: 'toast', message: '已清理全部记忆。' })
          }}
        >
          清理全部
        </Button>
      </div>
      {items.length === 0 ? <p className="aha-muted">目前没有保存的项目记忆。</p> : null}
      <ul className="aha-memory-list">
        {items.map((item) => (
          <li key={item.id} className="aha-memory-card">
            <div>
              <p className="aha-kicker">{item.project}</p>
              <p>{item.text}</p>
              <p className="aha-muted">{item.updated}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setItems((list) => list.filter((row) => row.id !== item.id))
                dispatch({ type: 'toast', message: `已清理「${item.project}」的一条记忆。` })
              }}
            >
              清理
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VoiceLockSection() {
  const { state, dispatch } = useWorkspace()
  const enrolledAt = state.prefs.voiceLockEnrolledAt
  const [enrolling, setEnrolling] = useState(false)
  const [progress, setProgress] = useState(0)

  const start = () => {
    setEnrolling(true)
    setProgress(0)
    let value = 0
    const timer = window.setInterval(() => {
      value += 8
      setProgress(Math.min(100, value))
      if (value >= 100) {
        window.clearInterval(timer)
        setEnrolling(false)
        dispatch({
          type: 'set-prefs',
          patch: { voiceLockEnrolledAt: Date.now(), voiceLockEnabled: true },
        })
        dispatch({ type: 'toast', message: '声纹已录入，声纹锁已打开。' })
      }
    }, 120)
  }

  return (
    <div className="aha-settings-stack">
      <p className="aha-muted">打开后，语音入口只响应已录入的声音。这是可点击的演示，不会真正采样麦克风。</p>
      {enrolling ? (
        <div className="aha-voicelock-progress">
          <strong>正在录入声纹…</strong>
          <div className="aha-meter-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span className="aha-meter-fill aha-meter-fill--primary" style={{ ['--aha-meter-fill' as string]: String(progress / 100) }} />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEnrolling(false)}>
            取消
          </Button>
        </div>
      ) : (
        <>
          <Switch
            checked={state.prefs.voiceLockEnabled}
            onChange={(value) => {
              if (value && !enrolledAt) {
                start()
                return
              }
              dispatch({ type: 'set-prefs', patch: { voiceLockEnabled: value } })
            }}
            label={state.prefs.voiceLockEnabled ? '只响应本人声音' : '声纹锁已关闭'}
          />
          <div className="aha-view-actions">
            <Button size="sm" variant="primary" onClick={start}>
              {enrolledAt ? '重新录入' : '录入声纹'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!enrolledAt}
              onClick={() => {
                dispatch({ type: 'set-prefs', patch: { voiceLockEnrolledAt: null, voiceLockEnabled: false } })
                dispatch({ type: 'toast', message: '已清除声纹。' })
              }}
            >
              清除声纹
            </Button>
          </div>
          {enrolledAt ? <p className="aha-muted">已录入示例声纹，可随时重新录入或清除。</p> : null}
        </>
      )}
    </div>
  )
}

function CollabSection() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-settings-stack">
      <p className="aha-muted">实验功能：让多台设备加入同一个会议。添加的主机也会出现在右侧连接主机卡片里。</p>
      <Switch
        checked={state.prefs.acceptRemoteTasks}
        onChange={(value) => dispatch({ type: 'set-prefs', patch: { acceptRemoteTasks: value } })}
        label="允许本机接收已批准的工作"
      />
      <h2 className="aha-settings-subhead">已连接主机</h2>
      <HostsGroup />
    </div>
  )
}

function GeneralSection() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-settings-stack">
      <div className="aha-settings-version">
        <span>当前版本 v0.0.0</span>
        <span className="aha-muted">已是最新</span>
      </div>
      <Field label="界面布局">
        <select
          className="aha-input"
          value={state.prefs.layoutMode}
          onChange={(event) => dispatch({ type: 'set-prefs', patch: { layoutMode: event.target.value as 'desktop' | 'handheld' } })}
        >
          <option value="desktop">桌面布局</option>
          <option value="handheld">掌机布局</option>
        </select>
      </Field>
      <div className="aha-settings-handheld">
        <p className="aha-muted">随身携带的附屏可同步讨论、审批和模拟语音。选择「掌机布局」时，工作区会改用窄屏堆叠排版。</p>
        <Button
          onClick={() => openHandheldWindow((message) => dispatch({ type: 'toast', message }))}
        >
          打开掌机附屏
        </Button>
      </div>
      <h2 className="aha-settings-subhead">Git 和源代码控制</h2>
      <GitGroup />
      <h2 className="aha-settings-subhead">快捷键</h2>
      <ShortcutGroup />
      <h2 className="aha-settings-subhead">通知消息</h2>
      <NoticeGroup />
    </div>
  )
}

function UpcomingSection() {
  const items = [
    {
      name: '账号与 AhaStudio Pro',
      desc: '登录 / 注册 / 订阅（$10/月 · 中国区 ¥39/月）、充值包与订单查询。社区版全部本地能力永久免费。',
    },
    {
      name: 'AhaTalk 处理路径与词库',
      desc: '本地 / 自有 Key / AhaTalk Cloud 三路径切换（禁止静默切换计费来源）；本地项目词库与跨设备同步。',
    },
    {
      name: 'AhaKey 设备配置',
      desc: '数字孪生编辑器：四模式键位映射、宏、OLED 动图、9 状态 × 17 灯效、拨杆语义与 IDE 配置联动。',
    },
    {
      name: '交接与同步',
      desc: 'Sync Vault 加密检查点、跨设备 Handoff（同一任务始终只有一个执行节点）、Trusted Device 配对。',
    },
  ]
  return (
    <div className="aha-settings-stack">
      <p className="aha-kicker">AhaStudio 新表面</p>
      <ul className="aha-upcoming-list">
        {items.map((item) => (
          <li key={item.name} className="aha-upcoming-card">
            <div>
              <strong>{item.name}</strong>
              <p className="aha-muted">{item.desc}</p>
            </div>
            <span className="aha-dev-tag">开发中</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AgentsGroup() {
  const { state, dispatch, openDiscussion } = useWorkspace()
  const [expanded, setExpanded] = useState(false)
  const inviteId = state.inviteDiscussionId
  const discussion = inviteId ? state.discussions.find((item) => item.id === inviteId) : undefined
  const sorted = useMemo(() => {
    const list = [...state.agents]
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (discussion) {
        const aFit = a.projectId === discussion.projectId || !a.projectId
        const bFit = b.projectId === discussion.projectId || !b.projectId
        if (aFit !== bFit) return aFit ? -1 : 1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    return list
  }, [discussion, state.agents])
  const visible = expanded ? sorted : sorted.slice(0, 5)
  const rest = Math.max(0, sorted.length - 5)

  return (
    <div className="aha-agents">
      <div className="aha-view-actions">
        {discussion ? <p className="aha-muted">正在为「{discussion.title}」邀请助理。加入后需点名才会发言。</p> : null}
        <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'new-agent' } })}>
          <IconPlus size={14} />
          新建智能体
        </Button>
      </div>
      <ul className="aha-agent-list">
        {visible.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </ul>
      {rest > 0 ? (
        <Button size="sm" variant="ghost" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起' : `展开更多（${rest}）`}
        </Button>
      ) : null}
      {discussion ? (
        <Button size="sm" onClick={() => openDiscussion(discussion.id)}>
          返回讨论
        </Button>
      ) : null}
    </div>
  )
}

function AgentRow({ agent }: { agent: Agent }) {
  const { state, dispatch, project, task } = useWorkspace()
  const discussion = state.inviteDiscussionId
    ? state.discussions.find((item) => item.id === state.inviteDiscussionId)
    : undefined
  const joined = discussion?.participantIds.includes(agent.id)
  const active = state.tasks.filter((item) => item.ownerAgentId === agent.id && item.status !== 'done')
  const canDelete = active.length === 0 && !joined
  const device = state.devices.find((item) => item.id === agent.deviceId)
  const invitable =
    discussion && (agent.projectId === discussion.projectId || !agent.projectId) && agent.id !== 'host'
  const status = joined ? '已加入讨论' : active.length ? '正在工作' : '可用'

  return (
    <li className="aha-agent-row">
      <Avatar agent={agent} />
      <div className="aha-agent-copy">
        <h3>
          {agent.name}
          {agent.role ? <em>{agent.role}</em> : null}
        </h3>
        <p>
          {agent.source === 'external' ? '外部接入' : agent.projectId ? project(agent.projectId)?.name : '工作区共享'}
          {device ? ` · ${device.name}` : ''}
          {agent.aiModel ? ` · ${agent.aiModel}` : ''}
          {agent.slug ? ` · @${agent.slug}` : ''}
        </p>
        <p className="aha-muted">{agent.description}</p>
        <p>
          <Badge tone={joined ? 'success' : active.length ? 'warning' : 'neutral'}>{status}</Badge>
          {active[0] ? <span> · {task(active[0].id)?.name}</span> : null}
        </p>
        {active.map((item) => (
          <TaskProcess key={item.id} task={item} events={eventsForTask(state.events, item.id)} variant="compact" />
        ))}
      </div>
      <div className="aha-agent-actions">
        {invitable ? (
          <Button
            size="sm"
            variant={joined ? 'secondary' : 'primary'}
            disabled={Boolean(joined)}
            onClick={() => discussion && dispatch({ type: 'invite-agent', discussionId: discussion.id, agentId: agent.id })}
          >
            {joined ? '已加入讨论' : '邀请'}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          icon
          aria-label={agent.pinned ? '取消置顶' : '置顶'}
          onClick={() => dispatch({ type: 'pin-agent', agentId: agent.id, pinned: !agent.pinned })}
        >
          <IconPin size={14} />
        </Button>
        <Button size="sm" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'edit-agent', agentId: agent.id } })}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canDelete}
          onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'confirm-delete-agent', agentId: agent.id } })}
        >
          删除
        </Button>
      </div>
    </li>
  )
}

function providerStatusLabel(status: string, hasKey: boolean) {
  if (status === 'checking') return '正在检查'
  if (status === 'success') return '已通过检查'
  if (status === 'failure') return '检查未通过'
  if (status === 'saved' || hasKey) return '已填写密钥'
  return '未配置'
}

function ProvidersGroup() {
  const { state, dispatch } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>('Anthropic')
  const [showKey, setShowKey] = useState(false)
  return (
    <div className="aha-settings-stack">
      <p className="aha-muted">在这里管理不同服务商的 API Key 和代理。检查只做格式校验，不会真正向服务商发请求。</p>
      <ul className="aha-provider-list">
        {state.providerAccounts.map((account) => {
          const open = openId === account.provider
          const models = PROVIDER_MODELS[account.provider] ?? ['默认模型']
          const configured = Boolean(account.apiKey.trim())
          return (
            <li key={account.provider} className={`aha-provider-card${open ? ' is-open' : ''}${configured ? ' is-ready' : ''}`}>
              <button
                type="button"
                className="aha-provider-card-head"
                aria-expanded={open}
                onClick={() => {
                  setOpenId(open ? null : account.provider)
                  setShowKey(false)
                }}
              >
                <span>
                  <strong>{account.provider}</strong>
                  <span className="aha-muted">{account.model}</span>
                </span>
                <Badge tone={account.status === 'success' || configured ? 'success' : account.status === 'failure' ? 'warning' : 'neutral'}>
                  {providerStatusLabel(account.status, configured)}
                </Badge>
              </button>
              {open ? (
                <div className="aha-form aha-provider-card-body">
                  <Field label="默认模型">
                    <select
                      className="aha-input"
                      value={account.model}
                      onChange={(event) =>
                        dispatch({ type: 'patch-provider-account', provider: account.provider, patch: { model: event.target.value, status: 'idle', message: undefined } })
                      }
                    >
                      {models.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="API Key">
                    <div className="aha-input-row">
                      <TextInput
                        type={showKey ? 'text' : 'password'}
                        value={account.apiKey}
                        maxLength={300}
                        placeholder="在此填写密钥"
                        onChange={(event) =>
                          dispatch({
                            type: 'patch-provider-account',
                            provider: account.provider,
                            patch: { apiKey: event.target.value, status: 'idle', message: undefined },
                          })
                        }
                      />
                      <Button size="sm" variant="ghost" icon aria-label={showKey ? '隐藏密钥' : '显示密钥'} onClick={() => setShowKey((value) => !value)}>
                        {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </Button>
                    </div>
                  </Field>
                  <Field label="代理地址（选填）">
                    <TextInput
                      value={account.proxyUrl}
                      maxLength={300}
                      placeholder="https://"
                      onChange={(event) =>
                        dispatch({
                          type: 'patch-provider-account',
                          provider: account.provider,
                          patch: { proxyUrl: event.target.value, status: 'idle', message: undefined },
                        })
                      }
                    />
                  </Field>
                  <div className="aha-decision-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        dispatch({
                          type: 'patch-provider-account',
                          provider: account.provider,
                          patch: { apiKey: '', proxyUrl: '', status: 'idle', message: undefined },
                        })
                      }
                    >
                      清除
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={account.status === 'checking'}
                      onClick={() => {
                        dispatch({
                          type: 'patch-provider-account',
                          provider: account.provider,
                          patch: { status: 'checking', message: undefined },
                        })
                        window.setTimeout(() => {
                          const proxyOk = !account.proxyUrl || /^https?:\/\//.test(account.proxyUrl)
                          if (!account.apiKey.trim() || !proxyOk) {
                            dispatch({
                              type: 'patch-provider-account',
                              provider: account.provider,
                              patch: {
                                status: 'failure',
                                message: !account.apiKey.trim() ? '请填写 API Key。' : '代理地址需要是 HTTP 或 HTTPS 格式。',
                              },
                            })
                            return
                          }
                          dispatch({
                            type: 'patch-provider-account',
                            provider: account.provider,
                            patch: {
                              status: 'success',
                              message: `已模拟检查 ${account.provider} · ${account.model}，凭据格式看起来可用。`,
                            },
                          })
                        }, 500)
                      }}
                    >
                      检查
                    </Button>
                  </div>
                  {account.status === 'checking' ? <p className="aha-muted">正在检查…</p> : null}
                  {account.status === 'success' ? <p className="aha-ok">{account.message}</p> : null}
                  {account.status === 'failure' ? <p className="aha-field-error">{account.message}</p> : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const MCP_TRANSPORTS: { id: McpTransport; label: string }[] = [
  { id: 'stdio', label: '本地命令' },
  { id: 'sse', label: 'SSE' },
  { id: 'http', label: 'HTTP' },
]

function McpSection() {
  const { state, dispatch } = useWorkspace()
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<McpTransport>('stdio')
  const [endpoint, setEndpoint] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addServer = () => {
    if (!name.trim()) return setError('请填写服务名称。')
    if (!endpoint.trim()) return setError('请填写命令或地址。')
    if ((transport === 'sse' || transport === 'http') && !/^https?:\/\//.test(endpoint.trim())) {
      return setError('SSE 和 HTTP 地址需要是 HTTP 或 HTTPS 格式。')
    }
    dispatch({
      type: 'add-mcp-server',
      server: {
        id: uid('mcp'),
        name: name.trim(),
        transport,
        endpoint: endpoint.trim(),
        enabled: true,
        tools: [],
        status: 'idle',
        detail: '已添加，检查后可模拟发现工具。',
      },
    })
    dispatch({ type: 'toast', message: `已添加 MCP「${name.trim()}」。` })
    setName('')
    setEndpoint('')
    setError(null)
  }

  return (
    <div className="aha-settings-stack">
      <p className="aha-muted">管理智能体可调用的 MCP 服务。开关和检查都在本机原型里模拟，不会真正启动进程或访问网络。</p>
      <ul className="aha-mcp-list">
        {state.mcpServers.map((server) => (
          <li key={server.id} className={`aha-mcp-card${server.enabled ? ' is-on' : ''}`}>
            <div className="aha-mcp-card-copy">
              <div className="aha-mcp-card-top">
                <strong>{server.name}</strong>
                <Badge tone={server.enabled && server.status === 'connected' ? 'success' : server.status === 'error' ? 'warning' : 'neutral'}>
                  {server.enabled ? (server.status === 'connected' ? '已连接' : server.status === 'error' ? '连接失败' : '已启用') : '已停用'}
                </Badge>
              </div>
              <p className="aha-muted">
                {MCP_TRANSPORTS.find((item) => item.id === server.transport)?.label} · {server.endpoint}
              </p>
              {server.tools.length ? <p className="aha-mcp-tools">{server.tools.join('、')}</p> : <p className="aha-muted">还没有发现工具。</p>}
              {server.detail ? <p className="aha-muted">{server.detail}</p> : null}
            </div>
            <div className="aha-mcp-card-actions">
              <Switch
                checked={server.enabled}
                onChange={(value) => {
                  dispatch({
                    type: 'patch-mcp-server',
                    id: server.id,
                    patch: value
                      ? { enabled: true, status: server.tools.length ? 'connected' : 'idle' }
                      : { enabled: false, status: 'idle' },
                  })
                  dispatch({ type: 'toast', message: value ? `已启用「${server.name}」` : `已停用「${server.name}」` })
                }}
                label={server.enabled ? '已启用' : '已停用'}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={!server.enabled}
                onClick={() => {
                  dispatch({ type: 'patch-mcp-server', id: server.id, patch: { status: 'idle', detail: '正在检查…' } })
                  window.setTimeout(() => {
                    const tools = server.tools.length ? server.tools : ['ping', 'list_resources']
                    dispatch({
                      type: 'patch-mcp-server',
                      id: server.id,
                      patch: {
                        status: 'connected',
                        tools,
                        detail: `已模拟连接，发现 ${tools.length} 个工具。`,
                      },
                    })
                    dispatch({ type: 'toast', message: `「${server.name}」已模拟连接。` })
                  }, 400)
                }}
              >
                检查
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  dispatch({ type: 'remove-mcp-server', id: server.id })
                  dispatch({ type: 'toast', message: `已移除「${server.name}」。` })
                }}
              >
                移除
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="aha-settings-subhead">添加 MCP</h2>
      <div className="aha-form">
        <div className="aha-form-split">
          <Field label="名称" error={error && !name.trim() ? error : undefined}>
            <TextInput value={name} maxLength={36} placeholder="例如 Playwright" onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="传输方式">
            <select className="aha-input" value={transport} onChange={(event) => setTransport(event.target.value as McpTransport)}>
              {MCP_TRANSPORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={transport === 'stdio' ? '启动命令' : '服务地址'} error={error && name.trim() ? error : undefined}>
          <TextInput
            value={endpoint}
            maxLength={300}
            placeholder={transport === 'stdio' ? 'npx -y @scope/server' : 'https://'}
            onChange={(event) => setEndpoint(event.target.value)}
          />
        </Field>
        <div className="aha-decision-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setName('')
              setEndpoint('')
              setError(null)
            }}
          >
            清空
          </Button>
          <Button size="sm" variant="primary" onClick={addServer}>
            添加
          </Button>
        </div>
      </div>
    </div>
  )
}

function HostsGroup() {
  const { state, dispatch } = useWorkspace()
  return (
    <div>
      <ul className="aha-host-list">
        {state.hosts.map((host) => (
          <li key={host.id} className="aha-host-card">
            <div className="aha-host-head">
              <strong>{host.name}</strong>
              <Badge tone="success">{host.connectionState === 'simulated' ? '已连接 · 模拟' : '已连接'}</Badge>
            </div>
            <p className="aha-muted">{host.hostAddress}</p>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'remote-host' } })}>
        添加远程主机
      </Button>
    </div>
  )
}

function VoiceGroup() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-form">
      <Field label="输入设备">
        <select
          className="aha-input"
          value={state.prefs.inputDevice}
          onChange={(event) => dispatch({ type: 'set-prefs', patch: { inputDevice: event.target.value as 'system' | 'handheld' } })}
        >
          <option value="system">系统默认麦克风</option>
          <option value="handheld">AhaStation 掌机</option>
        </select>
      </Field>
      <Field label="输入方式">
        <select
          className="aha-input"
          value={state.prefs.voiceInput}
          onChange={(event) => dispatch({ type: 'set-prefs', patch: { voiceInput: event.target.value as 'push' | 'continuous' } })}
        >
          <option value="push">按键说话</option>
          <option value="continuous">连续对话</option>
        </select>
      </Field>
    </div>
  )
}

function GitGroup() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-form">
      <Field label="默认基准分支" hint="最多 80 个字符。每个代码任务使用独立工作树。">
        <TextInput
          value={state.prefs.defaultBranch}
          maxLength={80}
          onChange={(event) => dispatch({ type: 'set-prefs', patch: { defaultBranch: event.target.value } })}
        />
      </Field>
    </div>
  )
}

function ShortcutGroup() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-form">
      <Field label="新建讨论">
        <select
          className="aha-input"
          value={state.prefs.newDiscussionKey}
          onChange={(event) =>
            dispatch({ type: 'set-prefs', patch: { newDiscussionKey: event.target.value as 'shift-cmd-n' | 'alt-cmd-n' } })
          }
        >
          <option value="shift-cmd-n">⇧⌘N</option>
          <option value="alt-cmd-n">⌥⌘N</option>
        </select>
      </Field>
      <Field label="语音">
        <select
          className="aha-input"
          value={state.prefs.voiceKey}
          onChange={(event) => dispatch({ type: 'set-prefs', patch: { voiceKey: event.target.value as 'space' | 'alt-space' } })}
        >
          <option value="space">Space</option>
          <option value="alt-space">⌥Space</option>
        </select>
      </Field>
    </div>
  )
}

function NoticeGroup() {
  const { state, dispatch } = useWorkspace()
  return (
    <div className="aha-form">
      <Switch
        checked={state.prefs.approvalNotifications}
        onChange={(value) => dispatch({ type: 'set-prefs', patch: { approvalNotifications: value } })}
        label="审批与授权请求通知"
      />
      <Switch
        checked={state.prefs.taskNotifications}
        onChange={(value) => dispatch({ type: 'set-prefs', patch: { taskNotifications: value } })}
        label="任务进展通知"
      />
    </div>
  )
}

export const SCAN = SCAN_CATALOG
