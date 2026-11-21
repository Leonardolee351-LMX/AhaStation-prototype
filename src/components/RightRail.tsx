import { useState, type ReactNode } from 'react'
import { INITIAL_USAGE, REPO_TREES } from '../data'
import { IconChevronDown, IconFile, IconFolder } from '../icons'
import { useWorkspace } from '../store'
import type { Device, Project, ProjectPane, RemoteHost, RepoNode, Task } from '../types'
import { displayedPercent, PROVIDER_LABEL, tightestSection } from '../usage'
import { Badge, Button, Meter, Switch } from '../ui'
import { UsageRoster } from './UsageRoster'

export function RightRail() {
  const { state, scope } = useWorkspace()
  if (!state.relatedOpen) return null
  const inProject = (scope.type === 'project' || scope.type === 'task') && Boolean(scope.projectId)
  return (
    <aside className="aha-right" aria-label="关联信息">
      <div className={`aha-right-stack${inProject ? ' is-repo' : ''}`}>
        {inProject && scope.projectId ? <RepoExplorer projectId={scope.projectId} /> : <OverviewPane />}
        <UsageSection defaultOpen={!inProject} />
      </div>
    </aside>
  )
}

function usageHint(display: 'remaining' | 'used') {
  const tightest = INITIAL_USAGE.map((provider) => ({ provider, section: tightestSection(provider) }))
    .filter((row): row is { provider: (typeof INITIAL_USAGE)[number]; section: NonNullable<ReturnType<typeof tightestSection>> } =>
      Boolean(row.section),
    )
    .sort((a, b) => b.section.window.usedPercent - a.section.window.usedPercent)[0]
  if (!tightest) return '查看各家额度'
  return `${PROVIDER_LABEL[tightest.provider.provider]} ${displayedPercent(tightest.section.window.usedPercent, display)}%`
}


function RailDisclose({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      className="aha-rail-disclose"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <IconChevronDown size={16} className="aha-disclose-chevron" />
        <span className="aha-rail-disclose-title">{title}</span>
        {hint ? <span className="aha-muted">{hint}</span> : null}
      </summary>
      <div className="aha-rail-disclose-body">{children}</div>
    </details>
  )
}

function UsageSection({ defaultOpen }: { defaultOpen: boolean }) {
  const { state } = useWorkspace()
  return (
    <RailDisclose title="额度" hint={usageHint(state.prefs.usageDisplay)} defaultOpen={defaultOpen}>
      <UsageRoster embedded />
    </RailDisclose>
  )
}

function hostStatusLabel(value: RemoteHost['connectionState']) {
  if (value === 'simulated') return '已连接 · 模拟'
  if (value === 'online') return '已连接'
  return '离线'
}

function HostCard({ host, device, selected }: { host: RemoteHost; device?: Device; selected: boolean }) {
  const { dispatch, openSettings } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const offline = host.connectionState === 'offline'

  const reconnect = () => {
    if (busy) return
    setBusy(true)
    dispatch({ type: 'patch-host', id: host.id, patch: { connectionState: 'offline' } })
    dispatch({ type: 'toast', message: `正在重新连接 ${host.name}…` })
    window.setTimeout(() => {
      dispatch({
        type: 'patch-host',
        id: host.id,
        patch: {
          connectionState: host.id.startsWith('added-') || host.connectionState === 'simulated' ? 'simulated' : 'online',
        },
      })
      setBusy(false)
    }, 700)
  }

  return (
    <li>
      <article className={`aha-host-card${selected ? ' is-selected' : ''}${offline ? ' is-offline' : ''}`}>
        <button
          type="button"
          className="aha-host-card-hit"
          aria-expanded={selected}
          aria-pressed={selected}
          onClick={() => dispatch({ type: 'select-host', id: selected ? null : host.id })}
        >
          <div className="aha-host-head">
            <strong>{host.name}</strong>
            <Badge tone={offline || busy ? 'neutral' : 'success'}>{busy ? '连接中' : hostStatusLabel(host.connectionState)}</Badge>
          </div>
          <p className="aha-muted">{host.hostAddress}</p>
          <div className="aha-host-meters">
            <Meter label="CPU" value={(device?.cpuPercent ?? 0) / 100} tone="primary" />
            <Meter label="内存" value={(device?.memoryPercent ?? 0) / 100} tone="primary" />
            <Meter label="磁盘" value={(device?.diskPercent ?? 0) / 100} tone="success" />
          </div>
        </button>
        {selected ? (
          <div className="aha-host-card-actions">
            <Switch
              checked={host.remoteReconnect}
              onChange={(value) => dispatch({ type: 'patch-host', id: host.id, patch: { remoteReconnect: value } })}
              label="自动重连"
            />
            <div className="aha-host-card-buttons">
              <Button size="sm" disabled={busy} onClick={reconnect}>
                {busy ? '连接中…' : '重新连接'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openSettings('collab')}>
                打开协作设置
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    </li>
  )
}

function OverviewPane() {
  const { state, pendingOf, dispatch, openTask } = useWorkspace()
  const pending = pendingOf()
  const pendingIds = new Set(pending.map((item) => item.taskId))
  const reviewTasks = state.tasks.filter((task) => task.status === 'review' && !pendingIds.has(task.id))
  const workingTasks = state.tasks.filter((task) => task.status === 'doing' && !pendingIds.has(task.id))
  const online = state.hosts.filter((host) => host.connectionState !== 'offline').length
  const preview = [
    ...pending.map((item) => {
      const task = state.tasks.find((row) => row.id === item.taskId)
      return task ? { id: task.id, label: '待审批', name: task.name } : null
    }),
    ...reviewTasks.map((task) => ({ id: task.id, label: '待验收', name: task.name })),
    ...workingTasks.map((task) => ({ id: task.id, label: '进行中', name: task.name })),
  ]
    .filter((row): row is { id: string; label: string; name: string } => Boolean(row))
    .slice(0, 4)

  return (
    <>
      <RailDisclose
        title="任务概况"
        hint={`${pending.length} 待审批 · ${reviewTasks.length} 待验收`}
        defaultOpen
      >
        <div>
          <ul className="aha-stat-list">
            <li>
              <span>待审批</span>
              <strong>{pending.length}</strong>
            </li>
            <li>
              <span>待验收</span>
              <strong>{reviewTasks.length}</strong>
            </li>
            <li>
              <span>进行中</span>
              <strong>{workingTasks.length}</strong>
            </li>
          </ul>
          {preview.length ? (
            <ul className="aha-overview-list">
              {preview.map((row) => (
                <li key={`${row.label}-${row.id}`}>
                  <button type="button" onClick={() => openTask(row.id)}>
                    <Badge tone={row.label === '待审批' ? 'warning' : row.label === '待验收' ? 'success' : 'soft'}>{row.label}</Badge>
                    <span>{row.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="aha-muted">当前没有需要关注的任务。</p>
          )}
        </div>
      </RailDisclose>
      <RailDisclose title="连接主机" hint={`${online} 台已连接`} defaultOpen>
        <div>
          <div className="aha-right-block-head">
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'remote-host' } })}>
              添加
            </Button>
          </div>
          <ul className="aha-host-list">
            {state.hosts.map((host) => (
              <HostCard
                key={host.id}
                host={host}
                device={state.devices.find((item) => item.id === host.id)}
                selected={state.selectedHostId === host.id}
              />
            ))}
          </ul>
        </div>
      </RailDisclose>
    </>
  )
}

function baseName(path?: string) {
  if (!path) return '项目'
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.split('/').pop() || trimmed
}

function worktreesFor(project: Project, tasks: Task[]) {
  const main = { id: 'main', name: baseName(project.path), path: project.path, branch: 'main', primary: true as const, taskId: undefined as string | undefined }
  const extras = tasks
    .filter((task) => task.projectId === project.id && (task.branch || task.status === 'doing' || task.status === 'review'))
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      name: task.branch ?? task.name,
      path: `${project.path}/.aha-worktrees/${task.branch ?? task.id}`,
      branch: task.branch,
      primary: false as const,
      taskId: task.id,
    }))
  const seen = new Set<string>()
  return [main, ...extras].filter((item) => {
    const key = item.path
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function RepoExplorer({ projectId }: { projectId: string }) {
  const { state, dispatch, project, openPr, openRepoFile, openTask } = useWorkspace()
  const item = project(projectId)
  const pane: ProjectPane = state.projectPane[projectId] ?? 'files'
  const trees = item?.repository ? (REPO_TREES[item.repository] ?? []) : []
  const prs = state.prs.filter((pr) => pr.projectId === projectId)
  const changes = prs.flatMap((pr) => pr.files.map((file) => ({ ...file, pr })))
  const treesList = item ? worktreesFor(item, state.tasks) : []
  const [activeTree, setActiveTree] = useState(treesList[0]?.id ?? 'main')
  const currentTree = treesList.find((row) => row.id === activeTree) ?? treesList[0]
  const rootName = currentTree?.name ?? item?.repository ?? item?.name ?? '项目'

  const setPane = (next: ProjectPane) => dispatch({ type: 'set-pane', projectId, pane: next })

  return (
    <div className="aha-repo-shell">
      <div className="aha-repo-tabs" role="tablist" aria-label="项目文件">
        {(
          [
            ['changes', '变更'],
            ['files', '文件'],
            ['worktree', '工作树'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pane === id}
            className={`aha-repo-tab${pane === id ? ' is-selected' : ''}`}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="aha-repo-body">
        {pane === 'changes' ? (
          changes.length === 0 ? (
            <p className="aha-muted">这个项目目前没有文件变更。</p>
          ) : (
            <ul className="aha-change-list">
              {changes.map((file) => (
                <li key={`${file.pr.number}-${file.path}`}>
                  <button type="button" onClick={() => openPr(file.pr.taskId, file.path)}>
                    <span className="aha-change-path">{file.path}</span>
                    <span className="aha-change-meta">
                      <Badge tone={file.changeType === 'add' ? 'success' : file.changeType === 'delete' ? 'warning' : 'soft'}>
                        {file.changeType === 'add' ? '新增' : file.changeType === 'delete' ? '删除' : '修改'}
                      </Badge>
                      <em>
                        +{file.added} / -{file.deleted}
                      </em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
        {pane === 'files' ? (
          trees.length === 0 ? (
            <p className="aha-muted">{item?.repository ? '这个仓库还没有可预览的文件。' : '这个项目还没有关联仓库。'}</p>
          ) : (
            <div className="aha-tree-root">
              <p className="aha-tree-root-name">{rootName}</p>
              <FileTree
                nodes={trees}
                onOpen={(path) => item?.repository && openRepoFile(projectId, item.repository, path)}
              />
            </div>
          )
        ) : null}
        {pane === 'worktree' ? (
          treesList.length === 0 ? (
            <p className="aha-muted">还没有工作树。</p>
          ) : (
            <ul className="aha-worktree-list">
              {treesList.map((tree) => (
                <li key={tree.id}>
                  <button
                    type="button"
                    className={tree.id === currentTree?.id ? 'is-selected' : ''}
                    onClick={() => {
                      setActiveTree(tree.id)
                      if (tree.taskId) openTask(tree.taskId)
                    }}
                  >
                    <strong>
                      {tree.name}
                      {tree.primary ? <em>主工作树</em> : null}
                    </strong>
                    <span>{tree.path}</span>
                    {tree.branch ? <span>{tree.branch}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  )
}

function FileTree({ nodes, onOpen }: { nodes: RepoNode[]; onOpen: (path: string) => void }) {
  return (
    <ul className="aha-tree">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.kind === 'dir' ? (
            <details>
              <summary>
                <IconChevronDown size={14} className="aha-disclose-chevron" />
                <IconFolder size={14} />
                {node.name}
              </summary>
              {node.children ? <FileTree nodes={node.children} onOpen={onOpen} /> : null}
            </details>
          ) : (
            <button type="button" className="aha-tree-file" onClick={() => onOpen(node.path)}>
              <IconFile size={14} />
              {node.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
