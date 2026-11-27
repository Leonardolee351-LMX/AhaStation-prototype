#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const rootDir = dirname(fileURLToPath(import.meta.url))
const port = 5177
const url = `http://localhost:${port}/`

function fail(message) {
  console.error(message)
  process.exit(1)
}

function canConnect(host) {
  return new Promise((resolveOk) => {
    const socket = createConnection({ host, port })
    const done = (ok) => {
      socket.removeAllListeners()
      try {
        socket.end()
        socket.destroy()
      } catch {
        // ignore
      }
      resolveOk(ok)
    }
    socket.setTimeout(400)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

async function isServerUp() {
  for (const host of ['127.0.0.1', '::1', 'localhost']) {
    if (await canConnect(host)) return true
  }
  return false
}

function openBrowser() {
  const platform = process.platform
  if (platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
  } else if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
  }
}

function runNpm(args, background = false) {
  const options = {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  }
  if (background) return spawn('npm', args, options)
  return spawnSync('npm', args, options)
}

if (!existsSync(join(rootDir, 'node_modules'))) {
  console.log('正在安装依赖…')
  const install = runNpm(['install'])
  if (install.status !== 0) fail('依赖安装失败。')
}

if (await isServerUp()) {
  console.log(`开发服务已在运行：${url}`)
  openBrowser()
  process.exit(0)
}

console.log(`正在启动 AhaStation 桌面工作区（未完成界面 Demo）：${url}`)
const child = runNpm(
  ['run', 'dev', '--', '--host', '--open', '--port', String(port), '--strictPort'],
  true,
)
child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
