import { useState, type CSSProperties } from 'react'
import { INITIAL_IDES, INITIAL_MEMORIES, PROVIDER_MODELS, SKILL_CATALOG } from '../data'
import { SETTINGS_GROUPS, type SettingsSectionId } from '../settings-sections'
import { useWorkspace } from '../store'

export const MODEL_QUOTAS = [
  { model: 'Claude', remaining: 12, color: 'var(--aha-data-aqua)' },
  { model: 'GLM', remaining: 48, color: 'var(--aha-blue-300)' },
  { model: 'GPT', remaining: 65, color: 'var(--aha-blue-400)' },
  { model: 'Grok', remaining: 16, color: 'var(--aha-data-ink)' },
  { model: 'GML', remaining: 89, color: 'var(--aha-aqua)' },
]

export function HandheldSettings() {
  const { state, dispatch } = useWorkspace()
  const [open, setOpen] = useState<SettingsSectionId | null>('backends')
  const [skills, setSkills] = useState(() => Object.fromEntries(SKILL_CATALOG.map((item) => [item.id, item.enabled])))
  const toggle = (id: SettingsSectionId) => setOpen((current) => (current === id ? null : id))

  return (
    <div className="hhp-settings">
      <section className="hhp-settings-quotas" aria-labelledby="hhp-quota-title">
        <h2 id="hhp-quota-title">模型剩余额度</h2>
        <ul className="hhp-quotas">
          {MODEL_QUOTAS.map(({ model, remaining, color }) => (
            <li key={model}>
              <span className="hhp-quota-ring" style={{ '--quota-value': `${remaining}%`, '--quota-color': color } as CSSProperties}>
                <strong>{remaining}%</strong>
              </span>
              <span>{model}</span>
            </li>
          ))}
        </ul>
      </section>

      {SETTINGS_GROUPS.map((group) => (
        <section key={group.label} className="hhp-settings-group">
          <h2>{group.label}</h2>
          {group.sections.map((section) => {
            const Icon = section.icon
            const expanded = open === section.id
            return (
              <div key={section.id} className={`hhp-settings-item${expanded ? ' is-open' : ''}`}>
                <button type="button" className="hhp-settings-item-head" aria-expanded={expanded} onClick={() => toggle(section.id)}>
                  <Icon size={18} />
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.description}</small>
                  </span>
                </button>
                {expanded ? (
                  <div className="hhp-settings-item-body">
                    {section.id === 'backends' ? (
                      <div className="hhp-settings-stack">
                        <p className="hhp-muted">默认模型供应商（模拟）</p>
                        <div className="hhp-settings-chips">
                          {['Anthropic', 'OpenAI', 'Google'].map((provider) => (
                            <button
                              key={provider}
                              type="button"
                              className={`hhp-button${state.prefs.defaultProvider === provider ? ' is-primary' : ''}`}
                              onClick={() => dispatch({ type: 'set-prefs', patch: { defaultProvider: provider } })}
                            >
                              {provider}
                            </button>
                          ))}
                        </div>
                        <ul className="hhp-settings-list">
                          {state.providerAccounts.filter((item) => PROVIDER_MODELS[item.provider]).slice(0, 6).map((item) => (
                            <li key={item.provider}>
                              <strong>{item.provider}</strong>
                              <span>{item.model}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {section.id === 'ahatalk' ? (
                      <div className="hhp-settings-stack">
                        <p className="hhp-muted">语音识别路径</p>
                        <div className="hhp-settings-chips">
                          {([['local', '本机'], ['key', '密钥'], ['cloud', '云端']] as const).map(([id, label]) => (
                            <button key={id} type="button" className={`hhp-button${state.prefs.ahaTalkPath === id ? ' is-primary' : ''}`}
                              onClick={() => dispatch({ type: 'set-prefs', patch: { ahaTalkPath: id } })}>{label}</button>
                          ))}
                        </div>
                        <label className="hhp-settings-switch">
                          <input type="checkbox" checked={state.prefs.voicePolish} onChange={(event) => dispatch({ type: 'set-prefs', patch: { voicePolish: event.target.checked } })} />
                          整理口语
                        </label>
                      </div>
                    ) : null}
                    {section.id === 'speech' ? (
                      <div className="hhp-settings-stack">
                        <label className="hhp-settings-switch">
                          <input type="checkbox" checked={state.prefs.reportMode} onChange={(event) => dispatch({ type: 'set-prefs', patch: { reportMode: event.target.checked } })} />
                          长回复分段播报
                        </label>
                      </div>
                    ) : null}
                    {section.id === 'ide' ? (
                      <div className="hhp-settings-chips">
                        {INITIAL_IDES.filter((ide) => ide.installed).map((ide) => (
                          <button key={ide.id} type="button" className={`hhp-button${state.prefs.defaultIde === ide.id ? ' is-primary' : ''}`}
                            onClick={() => dispatch({ type: 'set-prefs', patch: { defaultIde: ide.id } })}>{ide.name}</button>
                        ))}
                      </div>
                    ) : null}
                    {section.id === 'skills' ? (
                      <ul className="hhp-settings-list">
                        {SKILL_CATALOG.map((skill) => (
                          <li key={skill.id}>
                            <label className="hhp-settings-switch">
                              <input type="checkbox" checked={Boolean(skills[skill.id])} onChange={(event) => {
                                setSkills((current) => ({ ...current, [skill.id]: event.target.checked }))
                                dispatch({ type: 'toast', message: event.target.checked ? `已启用技能「${skill.name}」（模拟）` : `已关闭技能「${skill.name}」（模拟）` })
                              }} />
                              {skill.name}
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.id === 'mcp' ? (
                      <ul className="hhp-settings-list">
                        {state.mcpServers.map((server) => (
                          <li key={server.id}>
                            <label className="hhp-settings-switch">
                              <input type="checkbox" checked={server.enabled} onChange={(event) => {
                                dispatch({
                                  type: 'patch-mcp-server',
                                  id: server.id,
                                  patch: { enabled: event.target.checked, status: event.target.checked ? 'connected' : 'idle' },
                                })
                                dispatch({ type: 'toast', message: event.target.checked ? `已打开「${server.name}」（模拟）` : `已关闭「${server.name}」（模拟）` })
                              }} />
                              <span>
                                <strong>{server.name}</strong>
                                <small>{server.enabled ? '已连接（模拟）' : '已关闭'}</small>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.id === 'memory' ? (
                      <ul className="hhp-settings-list">
                        {INITIAL_MEMORIES.map((memory) => (
                          <li key={memory.id}>
                            <strong>{memory.project}</strong>
                            <span>{memory.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.id === 'voicelock' ? (
                      <label className="hhp-settings-switch">
                        <input type="checkbox" checked={state.prefs.voiceLockEnabled} onChange={(event) => dispatch({ type: 'set-prefs', patch: { voiceLockEnabled: event.target.checked } })} />
                        只响应你本人的声音
                      </label>
                    ) : null}
                    {section.id === 'collab' ? (
                      <label className="hhp-settings-switch">
                        <input type="checkbox" checked={state.prefs.acceptRemoteTasks} onChange={(event) => dispatch({ type: 'set-prefs', patch: { acceptRemoteTasks: event.target.checked } })} />
                        接受其他设备发来的任务
                      </label>
                    ) : null}
                    {section.id === 'general' ? (
                      <div className="hhp-settings-stack">
                        <p>AhaStation 原型 · He-1123</p>
                        <label className="hhp-settings-switch">
                          <input type="checkbox" checked={state.prefs.approvalNotifications} onChange={(event) => dispatch({ type: 'set-prefs', patch: { approvalNotifications: event.target.checked } })} />
                          审批通知
                        </label>
                        <label className="hhp-settings-switch">
                          <input type="checkbox" checked={state.prefs.taskNotifications} onChange={(event) => dispatch({ type: 'set-prefs', patch: { taskNotifications: event.target.checked } })} />
                          任务通知
                        </label>
                      </div>
                    ) : null}
                    {section.id === 'upcoming' ? <p className="hhp-muted">这些设置还在开发，当前原型里仅作预告。</p> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
