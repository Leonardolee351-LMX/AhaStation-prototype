import type { ReactNode } from 'react'
import type { TabKind } from '../types'

export type SurfaceKind = 'room' | 'project' | 'host' | 'agent' | 'terminal'

export function surfaceKindForTab(kind: TabKind): SurfaceKind | null {
  switch (kind) {
    case 'room':
      return 'room'
    case 'host':
      return 'host'
    case 'board':
    case 'discussion':
    case 'repo-file':
    case 'pr-diff':
      return 'project'
    case 'task':
    case 'task-file':
      return 'agent'
    case 'cli':
      return 'terminal'
    default:
      return null
  }
}

export function SurfaceLogo({
  kind,
  size = 20,
  letter,
  label,
}: {
  kind: SurfaceKind
  size?: number
  letter?: string
  label?: string
}) {
  const glyph = letter?.slice(0, 1)
  return (
    <svg
      className={`aha-surface-logo aha-surface-logo--${kind}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    >
      {kind === 'room' ? (
        <>
          <rect width="32" height="32" rx="8" fill="var(--aha-color-primary)" />
          <path
            d="M8 23V14.2L16 8.5l8 5.7V23"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M13 23v-6h6v6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        </>
      ) : null}
      {kind === 'project' ? (
        <>
          <rect width="32" height="32" rx="8" fill="var(--aha-color-primary)" />
          <path
            d="M7 12.5h7.2l2.2 2.3H25V23.5H7V12.5Z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M7 16.2h18" stroke="#fff" strokeWidth="1.8" />
        </>
      ) : null}
      {kind === 'host' ? (
        <>
          <rect width="32" height="32" rx="8" fill="var(--aha-color-primary)" />
          <circle cx="22" cy="10" r="4.5" fill="var(--aha-color-accent)" />
          <circle cx="16" cy="15" r="3.2" fill="#fff" />
          <path d="M16 19.4c-3.6 0-6.4 1.8-7 4.2h14c-.6-2.4-3.4-4.2-7-4.2Z" fill="#fff" />
        </>
      ) : null}
      {kind === 'agent' ? (
        <>
          <rect width="32" height="32" rx="8" fill="#0C7C8A" />
          {glyph ? (
            <text
              x="16"
              y="21.5"
              textAnchor="middle"
              fill="#fff"
              fontSize="14"
              fontWeight="700"
              fontFamily="var(--aha-heading-family, 'Plus Jakarta Sans', sans-serif)"
            >
              {glyph}
            </text>
          ) : (
            <>
              <circle cx="16" cy="13.5" r="3" fill="#fff" />
              <path d="M16 18c-3.2 0-5.6 1.6-6.2 3.8h12.4C21.6 19.6 19.2 18 16 18Z" fill="#fff" />
            </>
          )}
        </>
      ) : null}
      {kind === 'terminal' ? (
        <>
          <rect width="32" height="32" rx="8" fill="var(--aha-midnight)" />
          <path
            d="M9 12.5l5 3.5-5 3.5M16 20h8"
            fill="none"
            stroke="var(--aha-color-accent)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
    </svg>
  )
}

export function ViewTitle({
  kind,
  title,
  kicker,
  letter,
  children,
}: {
  kind: SurfaceKind
  title: string
  kicker?: string
  letter?: string
  children?: ReactNode
}) {
  return (
    <div className="aha-view-title">
      <SurfaceLogo kind={kind} size={32} letter={letter} />
      <div className="aha-view-title-copy">
        {kicker ? <p className="aha-kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}
