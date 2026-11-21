import type { ComponentType } from 'react'
import {
  IconBlocks,
  IconBrain,
  IconCode,
  IconCpu,
  IconFingerprint,
  IconNetwork,
  IconSettings,
  IconSpark,
  IconVoice,
  IconVolume,
} from './icons'

export type SettingsSectionId =
  | 'backends'
  | 'ahatalk'
  | 'speech'
  | 'ide'
  | 'skills'
  | 'mcp'
  | 'memory'
  | 'voicelock'
  | 'collab'
  | 'general'
  | 'upcoming'

export type SettingsSection = {
  id: SettingsSectionId
  title: string
  description: string
  icon: ComponentType<{ size?: number }>
}

export type SettingsGroup = {
  label: string
  sections: SettingsSection[]
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'AI 与语音',
    sections: [
      { id: 'backends', title: 'AI 后端', description: '管理各家大模型 API，并选择 Host 和 Worker 用谁', icon: IconCpu },
      { id: 'ahatalk', title: 'AhaTalk', description: '语音识别走哪条路径，口语要不要整理', icon: IconVoice },
      { id: 'speech', title: '播报', description: '播报音色、过滤哪些内容、长回复怎么念', icon: IconVolume },
    ],
  },
  {
    label: '工作区',
    sections: [
      { id: 'ide', title: '编辑器', description: '打开文件和交付成果时用哪个 IDE', icon: IconCode },
      { id: 'skills', title: '技能', description: '管理 Host 和 Worker 能调用的技能', icon: IconSpark },
      { id: 'mcp', title: 'MCP 工具', description: '添加、开关和检查智能体可调用的 MCP 服务', icon: IconBlocks },
      { id: 'memory', title: '记忆', description: '查看和清理 Host 记住的项目信息', icon: IconBrain },
    ],
  },
  {
    label: '安全与设备',
    sections: [
      { id: 'voicelock', title: '声纹锁', description: '只响应你本人的声音', icon: IconFingerprint },
      { id: 'collab', title: '多设备协作', description: '实验功能：让多台设备加入同一个会议', icon: IconNetwork },
    ],
  },
  {
    label: '其他',
    sections: [
      { id: 'general', title: '通用', description: '版本更新、桌面或掌机布局', icon: IconSettings },
      { id: 'upcoming', title: '即将推出', description: '正在开发、还不能用的设置', icon: IconBlocks },
    ],
  },
]

export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_GROUPS.flatMap((group) => group.sections)

const LEGACY: Record<string, SettingsSectionId> = {
  agents: 'backends',
  providers: 'backends',
  hosts: 'collab',
  voice: 'ahatalk',
  git: 'general',
  shortcuts: 'general',
  notifications: 'general',
}

export function resolveSettingsSection(focus: string | null | undefined): SettingsSectionId {
  if (!focus) return 'backends'
  if (focus.startsWith('backends')) return 'backends'
  if (focus in LEGACY) return LEGACY[focus]
  return SETTINGS_SECTIONS.find((section) => section.id === focus)?.id ?? 'backends'
}
