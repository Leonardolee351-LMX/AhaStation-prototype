export type UsageProviderId = 'claude' | 'codex' | 'kimi'
export type UsageDisplay = 'remaining' | 'used'
export type UsageDensity = 'verbose' | 'compact'
export type UsageTone = 'normal' | 'warning' | 'urgent'

export type RateLimitWindow = {
  usedPercent: number
  windowMinutes: number
  resetsAt: number | null
}

export type ProviderUsage = {
  provider: UsageProviderId
  session: RateLimitWindow | null
  weekly: RateLimitWindow | null
  planType?: string | null
  status: 'idle' | 'fetching' | 'ok' | 'error' | 'unavailable'
  error: string | null
  updatedAt: number
}

export type UsageSection = {
  key: 'session' | 'weekly'
  label: string
  window: RateLimitWindow
}

export const PROVIDER_LABEL: Record<UsageProviderId, string> = {
  claude: 'Claude',
  codex: 'Codex',
  kimi: 'Kimi',
}

export const USAGE_WARNING_PERCENT = 60
export const USAGE_URGENT_PERCENT = 80

export function clampUsed(usedPercent: number): number {
  return Number.isFinite(usedPercent) ? Math.max(0, Math.min(100, Math.round(usedPercent))) : 0
}

export function displayedPercent(usedPercent: number, display: UsageDisplay): number {
  const used = clampUsed(usedPercent)
  return display === 'used' ? used : 100 - used
}

export function usageTone(usedPercent: number): UsageTone {
  const used = clampUsed(usedPercent)
  return used >= USAGE_URGENT_PERCENT ? 'urgent' : used >= USAGE_WARNING_PERCENT ? 'warning' : 'normal'
}

export function usageSections(provider: ProviderUsage): UsageSection[] {
  const out: UsageSection[] = []
  if (provider.session) out.push({ key: 'session', label: '5 小时', window: provider.session })
  if (provider.weekly) out.push({ key: 'weekly', label: '本周', window: provider.weekly })
  return out
}

export function tightestSection(provider: ProviderUsage): UsageSection | null {
  const sections = usageSections(provider)
  if (!sections.length) return null
  return sections.reduce((a, b) => (clampUsed(b.window.usedPercent) > clampUsed(a.window.usedPercent) ? b : a))
}

export function sortWorstFirst(providers: ProviderUsage[]): ProviderUsage[] {
  return [...providers].sort((a, b) => {
    const aMax = tightestSection(a)
    const bMax = tightestSection(b)
    return (bMax ? clampUsed(bMax.window.usedPercent) : -1) - (aMax ? clampUsed(aMax.window.usedPercent) : -1)
  })
}

export function formatPercent(usedPercent: number, display: UsageDisplay): string {
  return `${display === 'used' ? '已用' : '剩余'} ${displayedPercent(usedPercent, display)}%`
}

export function formatUpdatedAgo(updatedAt: number, now: number): string {
  if (!updatedAt) return '尚未获取'
  const mins = Math.floor((now - updatedAt) / 60_000)
  if (mins < 1) return '刚刚更新'
  if (mins < 60) return `${mins} 分钟前更新`
  return `${Math.floor(mins / 60)} 小时前更新`
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  go: 'Go',
  plus: 'Plus',
  pro: 'Pro',
  prolite: 'Pro Lite',
  team: 'Team',
  business: 'Business',
  enterprise: 'Enterprise',
  edu: 'Edu',
}

export function formatPlan(planType: string | null | undefined): string | null {
  if (!planType) return null
  return PLAN_LABELS[planType.toLowerCase()] ?? planType.charAt(0).toUpperCase() + planType.slice(1)
}
