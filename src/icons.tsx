import type { ReactNode } from 'react'

type IconProps = {
  className?: string
  size?: number
}

function Icon({
  children,
  className,
  size = 16,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function IconKeyboard(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="2.2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7.5 13.5h9M9 16.5h6" />
    </Icon>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2L11 8.2h8.5A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
    </Icon>
  )
}

export function IconClone(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 9H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
      <rect x="9" y="3" width="12" height="12" rx="2" />
    </Icon>
  )
}

export function IconSpark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1" />
      <circle cx="12" cy="12" r="2.4" />
    </Icon>
  )
}

export function IconSend(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12 20 5l-6 14-2.5-5.5z" />
    </Icon>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </Icon>
  )
}

export function IconLayout(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M9 4v16M3.5 10h5.5" />
    </Icon>
  )
}

export function IconNote(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h8l5 5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5.5A1.5 1.5 0 0 1 7 4z" />
      <path d="M15 4v5h5M8.5 13h7M8.5 17h5" />
    </Icon>
  )
}

export function IconTerminal(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 10l3 2-3 2M12 14h5" />
    </Icon>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 6 8 12l6 6M8 12h10" />
    </Icon>
  )
}

export function IconRoom(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V7.5L12 4l8 3.5V20" />
      <path d="M9 20v-7h6v7" />
    </Icon>
  )
}

export function IconMeet(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="9" r="2.2" />
      <circle cx="16" cy="10" r="2" />
      <path d="M4.5 17c.4-2.2 2-3.5 3.5-3.5S11 14.8 11.4 17" />
      <path d="M13 17.2c.3-1.7 1.6-2.7 3-2.7s2.6 1 2.9 2.7" />
    </Icon>
  )
}


export function IconMic(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </Icon>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.5v1.6M12 17.9v1.6M7.2 6.3l1.1 1.1M15.7 16.6l1.1 1.1M4.5 12h1.6M17.9 12h1.6M7.2 17.7l1.1-1.1M15.7 7.4l1.1-1.1" />
    </Icon>
  )
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12a7 7 0 1 0 2-5M5 5v4h4" />
      <path d="M12 8v4l3 2" />
    </Icon>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6 9 12l5.5 6" />
    </Icon>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 6 15 12l-5.5 6" />
    </Icon>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9.5 12 15l6-5.5" />
    </Icon>
  )
}

export function IconPin(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4h6l1 5 3 2v1H5v-1l3-2zM12 12v8" />
    </Icon>
  )
}

export function IconEye(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.4" />
    </Icon>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5l16 14" />
      <path d="M9.9 6.1A10 10 0 0 1 12 6c5.5 0 9 6 9 6a15 15 0 0 1-2.2 2.8M6.2 8.4C4.4 9.8 3 12 3 12s3.5 6 9 6c1.3 0 2.5-.3 3.6-.8" />
    </Icon>
  )
}

export function IconFile(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h7l5 5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5.5A1.5 1.5 0 0 1 7 4z" />
      <path d="M14 4v5h5" />
    </Icon>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 14.5 7 17a3 3 0 0 1-4.2-4.2l3-3A3 3 0 0 1 10 9.5" />
      <path d="M14.5 9.5 17 7a3 3 0 1 1 4.2 4.2l-3 3A3 3 0 0 1 14 14.5" />
    </Icon>
  )
}

export function IconPanel(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M14.5 5v14" />
    </Icon>
  )
}

export function IconAt(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M16 12v1.4a2 2 0 0 0 2 2h0c2 0 2-2.2 2-3.4 0-4.4-3.6-8-8-8s-8 3.6-8 8 3.6 8 8 8c1.5 0 2.9-.4 4.1-1.1" />
      <circle cx="12" cy="12" r="2.6" />
    </Icon>
  )
}

export function IconHash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5l-2 14M17 5l-2 14M5 10h15M4 14h15" />
    </Icon>
  )
}

export function IconPaperclip(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 12.5l6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-8 8a4.2 4.2 0 0 1-6-6l7.3-7.3" />
    </Icon>
  )
}

export function IconSlash(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M14.5 7.5 9.5 16.5" />
    </Icon>
  )
}


export function IconCpu(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M7.5 4.5v2M16.5 4.5v2M7.5 17.5v2M16.5 17.5v2M4.5 7.5h2M17.5 7.5h2M4.5 16.5h2M17.5 16.5h2" />
    </Icon>
  )
}

export function IconVoice(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12c2-4 4-6 8-6s6 2 8 6" />
      <path d="M7 12c1.4-2.4 2.6-3.5 5-3.5s3.6 1.1 5 3.5" />
      <path d="M10 16.5v-3a2 2 0 1 1 4 0v3" />
      <path d="M9 18.5h6" />
    </Icon>
  )
}

export function IconVolume(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 10v4h3l4 3V7l-4 3H5z" />
      <path d="M16 9.5a3.2 3.2 0 0 1 0 5" />
      <path d="M17.8 7.4a5.5 5.5 0 0 1 0 9.2" />
    </Icon>
  )
}

export function IconCode(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 7.5 4.5 12 9 16.5" />
      <path d="M15 7.5 19.5 12 15 16.5" />
    </Icon>
  )
}

export function IconBrain(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6.5a3 3 0 0 0-3 3c0 .7.2 1.3.6 1.8A3 3 0 0 0 6 16a3 3 0 0 0 3 3c.6 0 1.1-.2 1.6-.4.5.8 1.4 1.4 2.4 1.4s1.9-.6 2.4-1.4c.5.3 1 .4 1.6.4a3 3 0 0 0 3-3 3 3 0 0 0-.6-1.7 3 3 0 0 0 .6-1.8 3 3 0 0 0-3-3 3.1 3.1 0 0 0-3-3h-.2A3.1 3.1 0 0 0 9 6.5Z" />
      <path d="M12 8.5v10" />
    </Icon>
  )
}

export function IconFingerprint(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 11.2a4 4 0 0 1 8 .4c0 3-1 6.2-3 9" />
      <path d="M6.4 8.6A7 7 0 0 1 19 12.2c0 2.2-.4 4.6-1.2 6.6" />
      <path d="M10.2 13.2c0 2.2-.6 4.4-1.8 6.3" />
      <path d="M12.2 7.2A4.8 4.8 0 0 1 16.8 12c0 1.2 0 3.6-.6 5.4" />
    </Icon>
  )
}

export function IconNetwork(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="18" cy="7" r="2.2" />
      <circle cx="12" cy="17" r="2.2" />
      <path d="M8 8.4 10.4 15M16 8.4 13.6 15" />
    </Icon>
  )
}

export function IconBlocks(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" />
      <path d="M15 16.5h5M17.5 14v5" />
    </Icon>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12a7 7 0 1 1-2-4.9" />
      <path d="M19 5v5h-5" />
    </Icon>
  )
}

export function ProviderMark({ id, size = 14 }: { id: string; size?: number }) {
  const colors: Record<string, string> = {
    claude: '#d97706',
    codex: '#16a34a',
    kimi: '#111827',
  }
  const label: Record<string, string> = { claude: 'C', codex: 'X', kimi: 'K' }
  return (
    <span
      className={`aha-provider-mark aha-provider-mark--${id}`}
      style={{ width: size, height: size, background: colors[id] ?? '#64748b', fontSize: Math.max(8, size * 0.62) }}
      aria-hidden="true"
    >
      {label[id] ?? id.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function Mascot({ size = 72 }: { size?: number }) {
  const uid = `mascot-${size}`
  return (
    <svg
      className="aha-mascot"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="AhaStation IP 形象占位"
    >
      <defs>
        <radialGradient id={`${uid}-blob`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="var(--aha-aqua)" />
          <stop offset="45%" stopColor="var(--aha-azure)" />
          <stop offset="100%" stopColor="var(--aha-midnight)" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="60" cy="66" rx="46" ry="28" fill="var(--aha-azure)" opacity="0.2" filter={`url(#${uid}-glow)`} />
      <path
        fill={`url(#${uid}-blob)`}
        filter={`url(#${uid}-glow)`}
        d="M34 70c-8-16 2-38 22-44 14-4 30 2 36 16 6 12 4 28-6 36-12 9-32 10-46 2-6-4-8-6-6-10z"
      />
      <ellipse cx="50" cy="60" rx="6.2" ry="9" fill="var(--aha-midnight)" />
      <ellipse cx="72" cy="59" rx="6.2" ry="9" fill="var(--aha-midnight)" />
      <ellipse cx="52" cy="57" rx="2" ry="2.4" fill="var(--aha-white)" opacity="0.85" />
      <ellipse cx="74" cy="56" rx="2" ry="2.4" fill="var(--aha-white)" opacity="0.85" />
    </svg>
  )
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--aha-color-primary)" />
      <circle cx="22" cy="10" r="5" fill="var(--aha-color-accent)" />
    </svg>
  )
}
