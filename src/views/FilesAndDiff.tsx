import { IconFile } from '../icons'
import { useWorkspace } from '../store'
import { Badge } from '../ui'

export function TaskFileView({ taskId, filePath }: { taskId: string; filePath?: string }) {
  const { state, dispatch, task, fileContent, activeTab } = useWorkspace()
  const item = task(taskId)
  const files = state.files.filter((file) => file.taskId === taskId)
  const selected = filePath ?? files[0]?.path
  const current = files.find((file) => file.path === selected)
  if (!item) return <div className="aha-empty">找不到这个任务。</div>
  if (files.length === 0) {
    return (
      <section className="aha-page">
        <h1>任务文件</h1>
        <p className="aha-muted">{item.repositoryId ? '这个任务还没有可预览的文件。' : '这是非代码任务，没有仓库文件。'}</p>
      </section>
    )
  }
  return (
    <section className="aha-page aha-split">
      <aside className="aha-split-side">
        <h2>任务文件</h2>
        <ul className="aha-file-list">
          {files.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                className={file.path === selected ? 'is-selected' : ''}
                onClick={() => activeTab && dispatch({ type: 'select-file', tabKey: activeTab.key, filePath: file.path })}
              >
                <IconFile size={14} />
                {file.path}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="aha-split-main">
        {current ? (
          <>
            <header>
              <p className="aha-kicker">{item.name}</p>
              <h1>{current.path}</h1>
              <p className="aha-muted">
                {current.repositoryId}
                {current.ref ? ` · ${current.ref}` : ''}
                {' · 只读快照'}
              </p>
            </header>
            <pre className="aha-code">{fileContent(current.repositoryId, current.path)}</pre>
          </>
        ) : (
          <p className="aha-muted">无法读取这份文件。</p>
        )}
      </div>
    </section>
  )
}

export function RepoFileView({
  projectId,
  repositoryId,
  filePath,
}: {
  projectId: string
  repositoryId: string
  filePath?: string
}) {
  const { project, fileContent } = useWorkspace()
  const item = project(projectId)
  const content = filePath ? fileContent(repositoryId, filePath) : undefined
  return (
    <section className="aha-page">
      <header>
        <p className="aha-kicker">{item?.name}</p>
        <h1>{filePath ?? '仓库文件'}</h1>
        <p className="aha-muted">
          {repositoryId}
          {filePath ? ` · ${filePath}` : ''}
          {' · 只读'}
        </p>
      </header>
      {content == null ? <p className="aha-muted">这份文件暂时无法读取。</p> : <pre className="aha-code">{content}</pre>}
    </section>
  )
}

export function PrDiffView({ taskId, filePath }: { taskId: string; filePath?: string }) {
  const { state, dispatch, task, activeTab } = useWorkspace()
  const pr = state.prs.find((item) => item.taskId === taskId)
  const item = task(taskId)
  if (!pr || !item) return <div className="aha-empty">找不到这个 PR。</div>
  const selected = filePath && pr.files.some((file) => file.path === filePath) ? filePath : pr.files[0]?.path
  const file = pr.files.find((row) => row.path === selected)
  return (
    <section className="aha-page aha-split">
      <aside className="aha-split-side">
        <p className="aha-kicker">{item.name}</p>
        <h2>
          PR #{pr.number} {pr.title}
        </h2>
        <p className="aha-muted">
          {pr.repositoryId} · {pr.headRef} → {pr.baseRef}
        </p>
        <ul className="aha-file-list">
          {pr.files.map((row) => (
            <li key={row.path}>
              <button
                type="button"
                className={row.path === selected ? 'is-selected' : ''}
                onClick={() => activeTab && dispatch({ type: 'select-file', tabKey: activeTab.key, filePath: row.path })}
              >
                <span>{row.path}</span>
                <em>
                  +{row.added} / -{row.deleted}
                </em>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="aha-split-main">
        {!file ? (
          <p className="aha-muted">这个 PR 还没有可对比的文件。</p>
        ) : (
          <>
            <header className="aha-diff-head">
              <h1>{file.path}</h1>
              <p>
                <Badge tone={file.changeType === 'add' ? 'success' : file.changeType === 'delete' ? 'warning' : 'soft'}>
                  {file.changeType === 'add' ? '新增' : file.changeType === 'delete' ? '删除' : '修改'}
                </Badge>
                <span>
                  +{file.added} / -{file.deleted}
                </span>
              </p>
            </header>
            <div className="aha-diff">
              <div>
                <h3>修改前</h3>
                {file.changeType === 'add' ? (
                  <p className="aha-muted">文件尚未创建</p>
                ) : (
                  <pre className="aha-code">
                    {file.hunks
                      .filter((line) => line.changeType !== 'add')
                      .map((line, index) => (
                        <span key={index} className={`aha-diff-line is-${line.changeType}`}>
                          <em>{line.oldLine ?? ''}</em>
                          {line.text}
                        </span>
                      ))}
                  </pre>
                )}
              </div>
              <div>
                <h3>修改后</h3>
                <pre className="aha-code">
                  {file.hunks
                    .filter((line) => line.changeType !== 'delete')
                    .map((line, index) => (
                      <span key={index} className={`aha-diff-line is-${line.changeType}`}>
                        <em>{line.newLine ?? ''}</em>
                        {line.text}
                      </span>
                    ))}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
