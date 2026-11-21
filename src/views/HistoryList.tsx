import { formatDateTime } from '../lib'
import { useWorkspace } from '../store'
import { AvatarStack, Badge } from '../ui'

export function HistoryList() {
  const { state, dispatch, project, agent, task } = useWorkspace()
  const rows = [...state.history].sort((a, b) => {
    const aTime = new Date(a.endedAt ?? a.startedAt).getTime()
    const bTime = new Date(b.endedAt ?? b.startedAt).getTime()
    return bTime - aTime
  })
  return (
    <section className="aha-page aha-history">
      <header className="aha-view-head">
        <div>
          <p className="aha-kicker">历史讨论</p>
          <h1>讨论记录</h1>
          <p className="aha-lead">按时间从新到旧排列。点击一行查看详情，并继续或重新开启讨论。</p>
        </div>
      </header>
      {rows.length === 0 ? <p className="aha-empty-title">暂无讨论记录</p> : (
        <ul className="aha-history-list">
          {rows.map((record) => {
            const people = record.participants
              .map((item) => agent(item.id) ?? { id: item.id, name: item.name, role: item.role, slug: item.id, description: '', source: 'seeded' as const, pinned: false, aiProvider: '', aiModel: '', reasoning: 'medium' as const, tools: [] as string[], skills: [] as string[] })
            const related = record.relatedTaskIds.map((id) => task(id)?.name).filter(Boolean)
            return (
              <li key={record.id}>
                <button type="button" className="aha-history-row" onClick={() => dispatch({ type: 'set-dialog', dialog: { type: 'history', recordId: record.id } })}>
                  <div>
                    <p className="aha-kicker">{project(record.projectId)?.name}</p>
                    <h2>{record.title}</h2>
                    <p className="aha-muted">
                      {formatDateTime(record.startedAt)}
                      {record.endedAt ? ' · 已结束' : ' · 进行中'}
                    </p>
                  </div>
                  <div className="aha-history-side">
                    <AvatarStack agents={people} />
                    {related.length ? <Badge tone="neutral">{related[0]}{related.length > 1 ? ` 等 ${related.length} 项` : ''}</Badge> : null}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
