import { useEffect, useState } from 'react'
import { startSoundLoop, stopSoundLoop } from '../audio'
import { LOCAL_WORKSPACES, SAMPLE_FOLDER, type LocalWorkspaceHit } from '../data'
import { isPlausiblePath, normalizePath, pathBasename } from '../lib'
import { buildProject, useWorkspace, validateNewProject } from '../store'
import type { Project } from '../types'
import { Button, Dialog, Field, TextInput } from '../ui'
import { PuzzleCompanion } from './PuzzleCompanion'

function toolsFromPath(path: string): LocalWorkspaceHit['tools'] {
  const value = path.toLowerCase()
  const tools: LocalWorkspaceHit['tools'] = []
  if (value.includes('cursor')) tools.push('Cursor')
  if (value.includes('trae')) tools.push('Trae')
  if (value.includes('codex')) tools.push('Codex')
  return tools
}

function alreadyImported(projects: Project[], path: string) {
  const target = normalizePath(path)
  return projects.some((project) => normalizePath(project.path) === target)
}

const SCAN_LINES = ['正在查找 .cursor 工作区…', '正在查找 .trae 工作区…', '正在查找 .codex 工作区…']

function LocalScanBody({ mode }: { mode: 'scan' | 'cite' }) {
  const { state, dispatch } = useWorkspace()
  const firstRun = !state.prefs.localScanDone
  const [phase, setPhase] = useState<'scanning' | 'results' | 'cite'>(mode === 'cite' ? 'cite' : 'scanning')
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'scanning') return
    startSoundLoop('loading', 'local-scan')
    return () => stopSoundLoop('local-scan')
  }, [phase])

  useEffect(() => {
    if (phase !== 'scanning') return
    const timers = [
      window.setTimeout(() => setTick(1), 450),
      window.setTimeout(() => setTick(2), 900),
      window.setTimeout(() => setTick(3), 1350),
      window.setTimeout(() => {
        setSelected(LOCAL_WORKSPACES.filter((item) => !alreadyImported(state.projects, item.path)).map((item) => item.id))
        setPhase('results')
      }, 1800),
    ]
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [phase, state.projects])

  const dismiss = (message?: string) => {
    if (firstRun) dispatch({ type: 'finish-local-scan', message })
    else dispatch({ type: 'set-dialog', dialog: null })
  }

  const importHits = (ids: string[]) => {
    const projects = ids
      .map((id) => LOCAL_WORKSPACES.find((item) => item.id === id))
      .filter((item): item is LocalWorkspaceHit => Boolean(item) && !alreadyImported(state.projects, item!.path))
      .map((item) => ({
        ...buildProject({ source: 'local', path: item.path, repository: '', name: item.name, location: '', entry: 'discussion' }),
        name: item.name,
      }))
    const count = projects.length
    dispatch({
      type: 'import-local-projects',
      projects,
      message: count ? `已引入 ${count} 个工作路径到项目室。` : '选中的路径已经在项目室里。',
    })
  }

  const submitPath = () => {
    const fields = { source: 'local' as const, path, repository: '', name: '', location: '', entry: 'discussion' as const }
    const invalid = validateNewProject(fields, state.projects)
    if (invalid) {
      setError(invalid.message)
      return
    }
    if (!isPlausiblePath(path)) {
      setError('请使用绝对路径、~/ 或盘符形式。')
      return
    }
    const project = buildProject(fields)
    if (pathBasename(project.path) !== pathBasename(path) && !project.name) {
      setError('请填写有效的文件夹路径。')
      return
    }
    dispatch({
      type: 'import-local-projects',
      projects: [project],
      message: `已把「${project.name}」引入项目室。`,
    })
  }

  const mood = phase === 'scanning' ? 'waiting' : phase === 'cite' ? 'present' : 'comfort'
  const lead =
    phase === 'scanning'
      ? '我先帮你看看本机上的工作文件。'
      : phase === 'cite'
        ? '你可以引用一个工作项目文件夹，这个路径会成为项目室里的一个项目。'
        : '我找到这些带 Cursor、Trae 或 Codex 标记的工作文件夹。勾选后引入项目室，也可以自己指定路径。'

  const body = (
    <div className="aha-scan-flow">
      <div className="aha-scan-presence">
        <PuzzleCompanion mood={mood} size={120} label="Aha，工作区助理" />
        <div>
          <p className="aha-kicker">{phase === 'scanning' ? '扫描本地工程文件中' : '本地工程'}</p>
          <p className="aha-scan-lead">{lead}</p>
        </div>
      </div>

      {phase === 'scanning' ? (
        <ul className="aha-scan-progress">
          {SCAN_LINES.map((line, index) => (
            <li key={line} className={index < tick ? 'is-on' : ''}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {phase === 'results' ? (
        <>
          <ul className="aha-scan-hits">
            {LOCAL_WORKSPACES.map((item) => {
              const imported = alreadyImported(state.projects, item.path)
              const checked = selected.includes(item.id)
              return (
                <li key={item.id}>
                  <label className={imported ? 'is-disabled' : ''}>
                    <input
                      type="checkbox"
                      disabled={imported}
                      checked={imported || checked}
                      onChange={() => {
                        setSelected((current) => (checked ? current.filter((id) => id !== item.id) : [...current, item.id]))
                      }}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <em>{item.path}</em>
                    </span>
                    <span className="aha-scan-tools">
                      {item.tools.map((tool) => (
                        <span key={tool}>{tool}</span>
                      ))}
                      {imported ? <span>已在项目室</span> : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="aha-scan-actions">
            <Button variant="primary" disabled={!selected.some((id) => !alreadyImported(state.projects, LOCAL_WORKSPACES.find((item) => item.id === id)?.path ?? ''))} onClick={() => importHits(selected)}>
              引入项目室
            </Button>
            <Button variant="secondary" onClick={() => setPhase('cite')}>
              引用工作项目文件夹
            </Button>
            <Button onClick={() => dismiss()}>{firstRun ? '稍后再说' : '取消'}</Button>
          </div>
        </>
      ) : null}

      {phase === 'cite' ? (
        <form
          className="aha-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitPath()
          }}
        >
          <Field label="工作路径" hint="文件夹里的 .cursor、.trae 或 .codex 会作为来源标记。" error={error ?? undefined}>
            <div className="aha-input-row">
              <TextInput
                value={path}
                maxLength={240}
                placeholder="~/Projects/example 或 E:/Work/example"
                onChange={(event) => {
                  setPath(event.target.value)
                  setError(null)
                }}
              />
              <Button size="sm" type="button" onClick={() => setPath(SAMPLE_FOLDER)}>
                浏览
              </Button>
            </div>
          </Field>
          {path.trim() ? (
            <p className="aha-muted">
              {toolsFromPath(path).length ? `识别到来源：${toolsFromPath(path).join('、')}` : '将按自定义路径引入。'}
            </p>
          ) : null}
          <div className="aha-scan-actions">
            <Button variant="primary" type="submit">
              引入项目室
            </Button>
            {mode === 'cite' && !firstRun ? (
              <Button onClick={() => dispatch({ type: 'set-dialog', dialog: null })}>取消</Button>
            ) : (
              <Button onClick={() => (mode === 'cite' && firstRun ? dismiss() : setPhase('results'))}>
                {mode === 'cite' && firstRun ? '稍后再说' : '返回扫描结果'}
              </Button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  )

  return body
}

export function LocalScanView({ variant, mode = 'scan' }: { variant: 'page' | 'dialog'; mode?: 'scan' | 'cite' }) {
  const { state, dispatch } = useWorkspace()
  if (variant === 'dialog') {
    return (
      <Dialog
        open
        title={mode === 'cite' ? '引用工作项目文件夹' : '扫描本地工程'}
        width="lg"
        onClose={() => {
          if (!state.prefs.localScanDone) {
            dispatch({ type: 'finish-local-scan' })
            return
          }
          dispatch({ type: 'set-dialog', dialog: null })
        }}
      >
        <LocalScanBody mode={mode} />
      </Dialog>
    )
  }
  return (
    <section className="aha-page aha-scan-page">
      <LocalScanBody mode={mode} />
    </section>
  )
}
