import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconClose, IconHistory, IconPanel, IconSettings } from '../icons'
import { SurfaceLogo, surfaceKindForTab } from './SurfaceLogo'
import { SETTINGS_GROUPS, type SettingsSectionId } from '../settings-sections'
import { useWorkspace } from '../store'
import { Button } from '../ui'

export function TopBar() {
  const { state, dispatch, activeTab, closeTab, openSettings, openHistory } = useWorkspace()
  const scroller = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsActive = activeTab?.kind === 'settings'

  useEffect(() => {
    const root = scroller.current
    if (!root || !state.activeTabKey) return
    const node = root.querySelector<HTMLElement>(`[data-tab="${state.activeTabKey}"]`)
    node?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [state.activeTabKey, state.tabs])

  useEffect(() => {
    if (!settingsOpen) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const onDown = (event: MouseEvent) => {
      if (settingsRef.current && event.target instanceof Node && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  const pickSection = (id: SettingsSectionId) => {
    setSettingsOpen(false)
    openSettings(id)
  }

  return (
    <header className="aha-top">
      <button
        type="button"
        className={`aha-brand${state.activeTabKey == null ? ' is-selected' : ''}`}
        aria-label="回到首页"
        aria-current={state.activeTabKey == null ? 'page' : undefined}
        onClick={() => dispatch({ type: 'select-tab', key: null })}
      >
        <img className="aha-brand-ip" src={`${import.meta.env.BASE_URL}ip/core-stand-front-128.png`} width={22} height={22} alt="" />
        <span className="aha-brand-name">AhaStation</span>
      </button>
      <div className="aha-tabstrip" ref={scroller} role="tablist" aria-label="工作区页签">
        {state.tabs.map((tab) => {
          const selected = tab.key === state.activeTabKey
          return (
            <div key={tab.key} className={`aha-tabchip${selected ? ' is-selected' : ''}`} data-tab={tab.key}>
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                className="aha-tabchip-btn"
                onClick={() => dispatch({ type: 'select-tab', key: tab.key })}
              >
                {surfaceKindForTab(tab.kind) ? (
                  <SurfaceLogo
                    kind={surfaceKindForTab(tab.kind)!}
                    size={16}
                    letter={tab.kind === 'task' || tab.kind === 'task-file' ? tab.title : undefined}
                  />
                ) : null}
                {tab.title}
              </button>
              <button
                type="button"
                className="aha-tabchip-close"
                aria-label={`关闭${tab.title}`}
                onClick={() => closeTab(tab.key)}
              >
                <IconClose size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="aha-top-actions">
        <Button
          size="sm"
          variant={state.relatedOpen ? 'secondary' : 'ghost'}
          onClick={() => dispatch({ type: 'set-related', open: !state.relatedOpen })}
          aria-pressed={state.relatedOpen}
        >
          <IconPanel size={16} />
          关联信息
        </Button>
        <Button size="sm" variant={activeTab?.kind === 'history' ? 'secondary' : 'ghost'} onClick={() => openHistory()}>
          <IconHistory size={16} />
          历史讨论
        </Button>
        <div className="aha-settings-menu" ref={settingsRef}>
          <Button
            size="sm"
            variant={settingsActive || settingsOpen ? 'secondary' : 'ghost'}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-label="设置"
            className={settingsOpen ? 'is-open' : ''}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <IconSettings size={16} />
            设置
            <IconChevronDown size={12} />
          </Button>
          {settingsOpen ? (
            <div
              className="aha-settings-dropdown"
              role="menu"
              aria-label="设置"
              ref={menuRef}
              onKeyDown={(event) => {
                const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
                const index = items.indexOf(document.activeElement as HTMLButtonElement)
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
                } else if (event.key === 'Escape') {
                  setSettingsOpen(false)
                  settingsRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
                }
              }}
            >
              {SETTINGS_GROUPS.map((group) => (
                <div className="aha-settings-dropdown-group" role="group" aria-label={group.label} key={group.label}>
                  <div className="aha-settings-dropdown-label">{group.label}</div>
                  {group.sections.map((item) => {
                    const Icon = item.icon
                    const current = settingsActive && state.settingsGroup === item.id
                    return (
                      <button
                        type="button"
                        role="menuitem"
                        className={`aha-settings-dropdown-item${current ? ' is-active' : ''}`}
                        key={item.id}
                        onClick={() => pickSection(item.id)}
                      >
                        <span className="aha-settings-dropdown-icon">
                          <Icon size={15} />
                        </span>
                        <span className="aha-settings-dropdown-text">
                          <span className="aha-settings-dropdown-title">{item.title}</span>
                          <span className="aha-settings-dropdown-desc">{item.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
