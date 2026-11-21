import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

export const COL_MIN = 220
export const COL_MAX = 480
export const CENTER_MIN = 360
export const COL_STEP = 8

export function defaultColWidths(viewport: number) {
  if (viewport <= 860) return { left: 220, right: 220 }
  if (viewport <= 1100) return { left: 240, right: 260 }
  return { left: 280, right: 300 }
}

export function clampColWidths(left: number, right: number, viewport: number, relatedOpen: boolean) {
  const maxLeft = Math.min(COL_MAX, Math.max(COL_MIN, viewport - (relatedOpen ? COL_MIN : 0) - CENTER_MIN))
  const leftClamped = Math.round(Math.min(maxLeft, Math.max(COL_MIN, left)))
  if (!relatedOpen) {
    return { left: leftClamped, right: Math.round(Math.min(COL_MAX, Math.max(COL_MIN, right))) }
  }
  const maxRight = Math.min(COL_MAX, Math.max(COL_MIN, viewport - leftClamped - CENTER_MIN))
  const rightClamped = Math.round(Math.min(maxRight, Math.max(COL_MIN, right)))
  return { left: leftClamped, right: rightClamped }
}

type Side = 'left' | 'right'

export function RailHandle({
  side,
  value,
  onDrag,
  onCommit,
  onReset,
}: {
  side: Side
  value: number
  onDrag: (width: number) => void
  onCommit: (width: number) => void
  onReset: () => void
}) {
  const origin = useRef({ x: 0, width: 0, last: 0 })

  useEffect(() => {
    return () => document.body.classList.remove('aha-is-resizing')
  }, [])

  const applyDelta = useCallback(
    (clientX: number) => {
      const dx = clientX - origin.current.x
      const next = side === 'left' ? origin.current.width + dx : origin.current.width - dx
      origin.current.last = next
      onDrag(next)
    },
    [onDrag, side],
  )

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    origin.current = { x: event.clientX, width: value, last: value }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.classList.add('is-dragging')
    document.body.classList.add('aha-is-resizing')
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    applyDelta(event.clientX)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragging = event.currentTarget.classList.contains('is-dragging')
    if (!dragging) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.currentTarget.classList.remove('is-dragging')
    document.body.classList.remove('aha-is-resizing')
    if (origin.current.last !== origin.current.width) onCommit(origin.current.last)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const dir = event.key === 'ArrowRight' ? 1 : -1
      const delta = side === 'left' ? dir * COL_STEP : -dir * COL_STEP
      onCommit(value + delta)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (event.key === 'Home') onReset()
      else onCommit(side === 'left' ? COL_MAX : COL_MAX)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onReset()
    }
  }

  return (
    <div
      className={`aha-rail-handle aha-rail-handle--${side}`}
      aria-label={side === 'left' ? '调整左侧栏宽度' : '调整右侧栏宽度'}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={COL_MIN}
      aria-valuemax={COL_MAX}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)} 像素`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(event) => {
        event.preventDefault()
        onReset()
      }}
      onKeyDown={onKeyDown}
    />
  )
}

