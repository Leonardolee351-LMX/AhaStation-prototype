export type SoundName = 'click' | 'message' | 'success' | 'fail' | 'celebrate' | 'loading' | 'dock' | 'undock'

type Priority = 'low' | 'normal' | 'high'

type ActiveSound = {
  name: SoundName
  source: AudioBufferSourceNode
  gain: GainNode
  priority: Priority
}

type LoopSound = {
  name: SoundName
  source: AudioBufferSourceNode
  gain: GainNode
}

const SOUND_BASE = `${import.meta.env.BASE_URL}sounds/`

const THROTTLE_MS: Record<SoundName, number> = {
  click: 90,
  message: 240,
  success: 180,
  fail: 180,
  celebrate: 700,
  loading: 400,
  dock: 320,
  undock: 320,
}

const VOLUME: Record<SoundName, number> = {
  click: 0.32,
  message: 0.5,
  success: 0.55,
  fail: 0.5,
  celebrate: 0.58,
  loading: 0.24,
  dock: 0.5,
  undock: 0.45,
}

const SOUND_NAMES: SoundName[] = ['click', 'message', 'success', 'fail', 'celebrate', 'loading', 'dock', 'undock']

let context: AudioContext | null = null
let muted = false
let unlocked = false
let lastHighPriorityAt = 0

const buffers = new Map<SoundName, AudioBuffer>()
const pendingBuffers = new Map<SoundName, Promise<AudioBuffer | null>>()
const lastPlayedAt = new Map<SoundName, number>()
const activeSounds: ActiveSound[] = []
const loopSounds = new Map<string, LoopSound>()
const loopTokens = new Map<string, number>()

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

function loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
  const ctx = audioContext()
  if (!ctx) return Promise.resolve(null)
  const cached = buffers.get(name)
  if (cached) return Promise.resolve(cached)
  const pending = pendingBuffers.get(name)
  if (pending) return pending

  const task = fetch(`${SOUND_BASE}${name}.wav`)
    .then((response) => {
      if (!response.ok) throw new Error(`sound ${name}: ${response.status}`)
      return response.arrayBuffer()
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(name, buffer)
      return buffer
    })
    .catch(() => null)
    .finally(() => {
      pendingBuffers.delete(name)
    })

  pendingBuffers.set(name, task)
  return task
}

function unlockAudio() {
  if (unlocked) return
  unlocked = true
  audioContext()
  SOUND_NAMES.forEach((name) => void loadBuffer(name))
}

if (typeof window !== 'undefined') {
  const removeUnlock = () => {
    window.removeEventListener('pointerdown', unlockAudio, true)
    window.removeEventListener('keydown', unlockAudio, true)
    window.removeEventListener('touchstart', unlockAudio, true)
  }
  window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true })
  window.addEventListener('keydown', unlockAudio, { capture: true })
  window.addEventListener('touchstart', unlockAudio, { capture: true, passive: true })
  // The first gesture is enough; keeping the listeners is harmless but wasteful.
  window.setTimeout(removeUnlock, 60_000)
}

function fadeOut(sound: Pick<ActiveSound, 'source' | 'gain'>, duration = 0.08) {
  const ctx = context
  if (!ctx) return
  const now = ctx.currentTime
  try {
    sound.gain.gain.cancelScheduledValues(now)
    sound.gain.gain.setValueAtTime(sound.gain.gain.value, now)
    sound.gain.gain.linearRampToValueAtTime(0.0001, now + duration)
    window.setTimeout(() => {
      try {
        sound.source.stop()
      } catch {
        /* already stopped */
      }
    }, duration * 1000 + 24)
  } catch {
    /* node already disconnected */
  }
}

function priorityOf(name: SoundName, requested?: Priority): Priority {
  if (requested) return requested
  if (name === 'click') return 'low'
  if (name === 'message') return 'normal'
  return 'high'
}

export function playSound(name: SoundName, options?: { priority?: Priority; volume?: number }) {
  if (muted || typeof window === 'undefined') return
  const now = Date.now()
  if (now - (lastPlayedAt.get(name) ?? 0) < THROTTLE_MS[name]) return

  const priority = priorityOf(name, options?.priority)
  if (priority === 'low' && now - lastHighPriorityAt < 180) return
  if (priority === 'high') {
    lastHighPriorityAt = now
    activeSounds.filter((sound) => sound.priority === 'low').forEach((sound) => fadeOut(sound))
  }

  lastPlayedAt.set(name, now)
  void loadBuffer(name).then((buffer) => {
    const ctx = context
    if (!buffer || !ctx || muted) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = options?.volume ?? VOLUME[name]
    source.connect(gain).connect(ctx.destination)

    const entry: ActiveSound = { name, source, gain, priority }
    activeSounds.push(entry)
    source.onended = () => {
      const index = activeSounds.indexOf(entry)
      if (index >= 0) activeSounds.splice(index, 1)
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    source.start()
  })
}

export function startSoundLoop(name: SoundName, key: string) {
  if (typeof window === 'undefined') return
  stopSoundLoop(key)
  const token = (loopTokens.get(key) ?? 0) + 1
  loopTokens.set(key, token)

  void loadBuffer(name).then((buffer) => {
    if (!buffer || loopTokens.get(key) !== token) return
    const ctx = context
    if (!ctx) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = muted ? 0 : VOLUME[name]
    source.connect(gain).connect(ctx.destination)
    source.start()
    loopSounds.set(key, { name, source, gain })
  })
}

export function stopSoundLoop(key: string) {
  loopTokens.set(key, (loopTokens.get(key) ?? 0) + 1)
  const loop = loopSounds.get(key)
  if (!loop) return
  loopSounds.delete(key)
  fadeOut(loop, 0.12)
}

export function setSoundMuted(value: boolean) {
  muted = value
  if (!context || typeof window === 'undefined') return
  const now = context.currentTime
  loopSounds.forEach((loop) => {
    try {
      loop.gain.gain.cancelScheduledValues(now)
      loop.gain.gain.setValueAtTime(loop.gain.gain.value, now)
      loop.gain.gain.linearRampToValueAtTime(muted ? 0.0001 : VOLUME[loop.name], now + 0.04)
    } catch {
      /* node already disconnected */
    }
  })
}

export function isSoundMuted() {
  return muted
}
