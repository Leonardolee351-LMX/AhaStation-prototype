import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { HostBriefing } from './components/HostBriefing'
import { LocalScanView } from './components/LocalScanView'
import { LeftRail } from './components/LeftRail'
import { RailHandle, clampColWidths, defaultColWidths } from './components/RailHandles'
import { RightRail } from './components/RightRail'
import { TopBar } from './components/TopBar'
import { WorkspaceDialogs } from './dialogs/WorkspaceDialogs'
import { HandheldScreen } from './handheld/HandheldDock'
import { WorkspaceProvider, isHandheldView, useWorkspace } from './store'
import { IconChevronLeft, IconChevronRight } from './icons'
import { Toast } from './ui'
import { CliWorkspace } from './views/CliWorkspace'
import { DiscussionView } from './views/Discussion'
import { PrDiffView, RepoFileView, TaskFileView } from './views/FilesAndDiff'
import { HistoryList } from './views/HistoryList'
import { HostChat } from './views/HostChat'
import { ProjectRoom } from './views/ProjectRoom'
import { SettingsView } from './views/Settings'
import { TaskBoard } from './views/TaskBoard'
import { TaskSession } from './views/TaskSession'

export default function App() {
  return (
    <WorkspaceProvider>
      {isHandheldView() ? <HandheldScreen /> : <WorkspaceShell />}
    </WorkspaceProvider>
  )
}

function useWorkspaceWidth() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

const PROJECT_TAB_KINDS = new Set([
  'room',
  'board',
  'cli',
  'discussion',
  'task',
  'task-file',
  'pr-diff',
  'repo-file',
])

function WorkspaceShell() {
  const { state, dispatch, activeTab } = useWorkspace()
  const width = useWorkspaceWidth()
  const compact = state.prefs.layoutMode === 'handheld' || width <= 750
  const tiny = width <= 450
  const inProject = Boolean(activeTab && PROJECT_TAB_KINDS.has(activeTab.kind))
  const [leftRevealed, setLeftRevealed] = useState(false)
  const showLeft = inProject || leftRevealed
  const [draft, setDraft] = useState<{ left?: number; right?: number } | null>(null)

  useEffect(() => {
    if (inProject) setLeftRevealed(false)
  }, [inProject])
  const defaults = defaultColWidths(width)
  const preferredLeft = draft?.left ?? state.prefs.leftColWidth ?? defaults.left
  const preferredRight = draft?.right ?? state.prefs.rightColWidth ?? defaults.right
  const cols = useMemo(
    () => clampColWidths(preferredLeft, preferredRight, width, state.relatedOpen),
    [preferredLeft, preferredRight, width, state.relatedOpen],
  )
  const className = [
    'aha-app',
    state.relatedOpen ? 'has-right' : '',
    compact ? 'is-compact' : '',
    tiny ? 'is-tiny' : '',
    draft ? 'is-resizing' : '',
    showLeft ? '' : 'is-left-collapsed',
  ]
    .filter(Boolean)
    .join(' ')
  const style = compact
    ? undefined
    : ({
        '--aha-left-col': `${cols.left}px`,
        '--aha-right-col': `${cols.right}px`,
      } as CSSProperties)

  const commitLeft = (next: number) => {
    const { left } = clampColWidths(next, cols.right, width, state.relatedOpen)
    setDraft(null)
    dispatch({ type: 'set-prefs', patch: { leftColWidth: left } })
  }
  const commitRight = (next: number) => {
    const { right } = clampColWidths(cols.left, next, width, state.relatedOpen)
    setDraft(null)
    dispatch({ type: 'set-prefs', patch: { rightColWidth: right } })
  }

  return (
    <div className={className} style={style}>
      {showLeft ? <LeftRail /> : null}
      {showLeft ? null : (
        <button
          type="button"
          className="aha-left-reveal"
          aria-label="显示左侧栏"
          onClick={() => setLeftRevealed(true)}
        >
          <IconChevronRight size={16} />
        </button>
      )}
      {showLeft && !inProject ? (
        <button
          type="button"
          className="aha-left-fold"
          aria-label="收起左侧栏"
          onClick={() => setLeftRevealed(false)}
        >
          <IconChevronLeft size={16} />
        </button>
      ) : null}
      <div className="aha-main">
        <TopBar />
        <div className="aha-body">
          <main id="main" className="aha-center" tabIndex={-1}>
            <ActiveView />
          </main>
          {state.relatedOpen ? <RightRail /> : null}
        </div>
      </div>
      {!compact ? (
        <div className="aha-rail-handles">
          {showLeft ? (
          <RailHandle
            side="left"
            value={cols.left}
            onDrag={(next) => setDraft((current) => ({ ...current, left: next }))}
            onCommit={commitLeft}
            onReset={() => {
              setDraft(null)
              dispatch({ type: 'set-prefs', patch: { leftColWidth: undefined } })
            }}
          />
          ) : null}
          {state.relatedOpen ? (
            <RailHandle
              side="right"
              value={cols.right}
              onDrag={(next) => setDraft((current) => ({ ...current, right: next }))}
              onCommit={commitRight}
              onReset={() => {
                setDraft(null)
                dispatch({ type: 'set-prefs', patch: { rightColWidth: undefined } })
              }}
            />
          ) : null}
        </div>
      ) : null}
      <WorkspaceDialogs />
      <Toast message={state.toast} />
    </div>
  )
}

function ActiveView() {
  const { state, activeTab } = useWorkspace()
  if (!state.prefs.localScanDone) {
    return <LocalScanView variant="page" />
  }
  if (!activeTab) {
    return (
      <section className="aha-page aha-briefing-page">
        <HostBriefing variant="empty" />
      </section>
    )
  }
  switch (activeTab.kind) {
    case 'room':
      return <ProjectRoom />
    case 'host':
      return <HostChat />
    case 'history':
      return <HistoryList />
    case 'settings':
      return <SettingsView />
    case 'board':
      return activeTab.projectId ? <TaskBoard projectId={activeTab.projectId} /> : null
    case 'cli':
      return activeTab.projectId ? <CliWorkspace projectId={activeTab.projectId} /> : null
    case 'discussion':
      return activeTab.entityId ? <DiscussionView discussionId={activeTab.entityId} /> : null
    case 'task':
      return activeTab.entityId ? <TaskSession taskId={activeTab.entityId} /> : null
    case 'task-file':
      return activeTab.entityId ? <TaskFileView taskId={activeTab.entityId} filePath={activeTab.filePath} /> : null
    case 'pr-diff':
      return activeTab.entityId ? <PrDiffView taskId={activeTab.entityId} filePath={activeTab.filePath} /> : null
    case 'repo-file':
      return activeTab.projectId && activeTab.entityId ? (
        <RepoFileView projectId={activeTab.projectId} repositoryId={activeTab.entityId} filePath={activeTab.filePath} />
      ) : null
    default:
      return null
  }
}
