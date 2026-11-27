import { useEffect, useState } from 'react'

export type CompanionMood = 'present' | 'comfort' | 'idle' | 'listening' | 'waiting'

const ASSETS: Record<CompanionMood, { file: string; preview?: string }> = {
  present: { file: 'core-stand-front.png', preview: 'core-stand-front-128.png' },
  comfort: { file: 'core-comfort.png', preview: 'core-comfort-128.png' },
  idle: { file: 'core-idle.png', preview: 'core-idle-128.png' },
  listening: { file: 'core-listening.png', preview: 'core-listening-128.png' },
  waiting: { file: 'core-waiting.png', preview: 'core-waiting-128.png' },
}

const REST_MIN = 8000
const REST_SPAN = 4000
const REST_HOLD = 1400

function assetUrl(file: string) {
  return `${import.meta.env.BASE_URL}ip/${file}`
}

export function PuzzleCompanion({
  mood = 'present',
  size = 80,
  label = 'Aha，工作区助理',
  className = '',
}: {
  mood?: CompanionMood
  size?: number
  label?: string
  className?: string
}) {
  const [resting, setResting] = useState(false)
  const canRest = mood === 'present' || mood === 'comfort'

  useEffect(() => {
    if (!canRest) {
      setResting(false)
      return
    }

    let cancelled = false
    let sleep = 0
    let hold = 0
    const preload = new Image()
    preload.src = assetUrl(ASSETS.idle.file)

    const schedule = () => {
      sleep = window.setTimeout(() => {
        if (cancelled) return
        setResting(true)
        hold = window.setTimeout(() => {
          if (cancelled) return
          setResting(false)
          schedule()
        }, REST_HOLD)
      }, REST_MIN + Math.random() * REST_SPAN)
    }

    schedule()
    return () => {
      cancelled = true
      window.clearTimeout(sleep)
      window.clearTimeout(hold)
    }
  }, [canRest, mood])

  const shown: CompanionMood = canRest && resting ? 'idle' : mood
  const asset = ASSETS[shown]
  const src = assetUrl(asset.file)
  const srcSet = asset.preview ? `${assetUrl(asset.preview)} 128w, ${src} 512w` : undefined

  return (
    <figure
      className={['aha-companion', `aha-companion--${mood}`, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <span className="aha-companion-field" aria-hidden="true" />
      <img
        className={`aha-companion-figure${shown === 'present' ? ' is-stand' : ''}`}
        src={src}
        srcSet={srcSet}
        sizes={`${size}px`}
        alt=""
        width={size}
        height={size}
        draggable={false}
      />
    </figure>
  )
}
