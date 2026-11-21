import { useState } from 'react'
import { INITIAL_USAGE } from '../data'
import { IconRefresh } from '../icons'
import { ProviderMark } from '../icons'
import { useWorkspace } from '../store'
import {
  displayedPercent,
  formatPercent,
  formatPlan,
  formatUpdatedAgo,
  sortWorstFirst,
  tightestSection,
  usageSections,
  usageTone,
  type ProviderUsage,
  type UsageDisplay,
  type UsageDensity,
  type UsageSection,
} from '../usage'
import { Button } from '../ui'

function Bar({ section, display, wide = false }: { section: UsageSection; display: UsageDisplay; wide?: boolean }) {
  const used = section.window.usedPercent
  return (
    <span className={`aha-usage-bar${wide ? ' is-wide' : ''}`} data-tone={usageTone(used)} aria-hidden="true">
      <span style={{ width: `${displayedPercent(used, display)}%` }} />
    </span>
  )
}

function UsageChip({
  provider,
  display,
  density,
  onOpen,
}: {
  provider: ProviderUsage
  display: UsageDisplay
  density: UsageDensity
  onOpen: () => void
}) {
  const sections = usageSections(provider)
  const tightest = tightestSection(provider)
  const shown = density === 'compact' ? (tightest ? [tightest] : []) : sections
  const title = sections
    .map((section) => `${section.label}：${formatPercent(section.window.usedPercent, display)}`)
    .join('\n')
  return (
    <button
      type="button"
      className="aha-usage-chip"
      onClick={onOpen}
      title={title}
      data-tone={tightest ? usageTone(tightest.window.usedPercent) : 'normal'}
    >
      <span className="aha-usage-chip-head">
        <ProviderMark id={provider.provider} size={16} />
        <span className="aha-usage-chip-name">{provider.provider === 'claude' ? 'Claude' : provider.provider === 'codex' ? 'Codex' : 'Kimi'}</span>
      </span>
      <span className="aha-usage-chip-windows">
        {shown.map((section) => (
          <span className="aha-usage-chip-window" key={section.key}>
            <Bar section={section} display={display} wide />
            <span className="aha-usage-chip-pct">{displayedPercent(section.window.usedPercent, display)}%</span>
            <span className="aha-usage-chip-label">{section.label.replace(' ', '')}</span>
          </span>
        ))}
      </span>
    </button>
  )
}

export function UsageRoster({ embedded = false }: { embedded?: boolean }) {
  const { state, dispatch } = useWorkspace()
  const display = state.prefs.usageDisplay
  const density = state.prefs.usageDensity
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(INITIAL_USAGE[0]?.updatedAt ?? Date.now())
  const providers = INITIAL_USAGE
  const now = Date.now()

  return (
    <section className={`aha-right-block aha-usage-block${embedded ? ' is-embedded' : ''}`}>
      <div className="aha-usage-head">
        {embedded ? <span className="aha-usage-embedded-label">各家额度</span> : <h2>额度</h2>}
        <span className="aha-muted">{refreshing ? '刷新中…' : formatUpdatedAgo(updatedAt, now)}</span>
        <button
          type="button"
          className="aha-usage-refresh"
          aria-label="刷新额度"
          title="刷新额度"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true)
            window.setTimeout(() => {
              setRefreshing(false)
              setUpdatedAt(Date.now())
              dispatch({ type: 'toast', message: '已按本机登录刷新额度（示例数据）。' })
            }, 450)
          }}
        >
          <IconRefresh size={13} className={refreshing ? 'is-spinning' : undefined} />
        </button>
      </div>
      <div className="aha-usage-chips">
        {providers.map((provider) => (
          <UsageChip
            key={provider.provider}
            provider={provider}
            display={display}
            density={density}
            onOpen={() => setOpen((value) => !value)}
          />
        ))}
      </div>
      {open ? (
        <div className="aha-usage-panel" role="dialog" aria-label="各 AI 额度">
          <div className="aha-usage-panel-head">
            <strong>各公司额度</strong>
            <span>全部 AI · 最紧张的在上</span>
          </div>
          <div className="aha-usage-panel-controls">
            <div className="aha-usage-seg" role="radiogroup" aria-label="显示方式">
              <button
                type="button"
                role="radio"
                aria-checked={display === 'remaining'}
                className={display === 'remaining' ? 'is-active' : ''}
                onClick={() => dispatch({ type: 'set-prefs', patch: { usageDisplay: 'remaining' } })}
              >
                显示剩余
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={display === 'used'}
                className={display === 'used' ? 'is-active' : ''}
                onClick={() => dispatch({ type: 'set-prefs', patch: { usageDisplay: 'used' } })}
              >
                显示已用
              </button>
            </div>
            <div className="aha-usage-seg" role="radiogroup" aria-label="额度条详细程度">
              <button
                type="button"
                role="radio"
                aria-checked={density === 'verbose'}
                className={density === 'verbose' ? 'is-active' : ''}
                onClick={() => dispatch({ type: 'set-prefs', patch: { usageDensity: 'verbose' } })}
              >
                详细
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={density === 'compact'}
                className={density === 'compact' ? 'is-active' : ''}
                onClick={() => dispatch({ type: 'set-prefs', patch: { usageDensity: 'compact' } })}
              >
                紧凑
              </button>
            </div>
          </div>
          <div className="aha-usage-rows">
            {sortWorstFirst(providers).map((provider) => {
              const sections = usageSections(provider)
              const plan = formatPlan(provider.planType)
              return (
                <div className="aha-usage-row" key={provider.provider}>
                  <div className="aha-usage-row-head">
                    <ProviderMark id={provider.provider} size={14} />
                    <strong>
                      {provider.provider === 'claude' ? 'Claude' : provider.provider === 'codex' ? 'Codex' : 'Kimi'}
                      {plan ? <span className="aha-muted"> · {plan}</span> : null}
                    </strong>
                  </div>
                  {sections.map((section) => (
                    <div className="aha-usage-row-window" key={section.key}>
                      <span>{section.label}</span>
                      <Bar section={section} display={display} wide />
                      <span data-tone={usageTone(section.window.usedPercent)}>
                        {formatPercent(section.window.usedPercent, display)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <p className="aha-usage-foot">示例数据对应正式额度条。读取各 CLI 的本机登录，不另存凭据。</p>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            收起
          </Button>
        </div>
      ) : null}
    </section>
  )
}
