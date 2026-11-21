import { SOURCE_LABEL } from '../types'
import { ViewTitle } from '../components/SurfaceLogo'
import { useWorkspace } from '../store'

export function CliWorkspace({ projectId }: { projectId: string }) {
  const { project } = useWorkspace()
  const item = project(projectId)
  if (!item) return <div className="aha-empty">找不到这个项目。</div>
  return (
    <section className="aha-page aha-cli">
      <header className="aha-view-head">
        <ViewTitle kind="terminal" kicker="CLI 工作区" title={item.name} />
      </header>
      <dl className="aha-meta aha-meta--wide">
        <div>
          <dt>项目来源</dt>
          <dd>{SOURCE_LABEL[item.source]}</dd>
        </div>
        <div>
          <dt>工作目录</dt>
          <dd>
            <code>{item.path}</code>
          </dd>
        </div>
        {item.repository ? (
          <div>
            <dt>仓库地址</dt>
            <dd>
              <code>{item.repository}</code>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="aha-terminal" aria-label="终端预览">
        <p className="aha-terminal-muted"># 终端预览</p>
        <p>$ pwd</p>
        <p>{item.path.replace(/^~/, '/Users/leonardo')}</p>
        <p className="aha-terminal-muted"># 正式对接后，这里会回显真实工作目录与命令结果。</p>
      </div>
    </section>
  )
}
