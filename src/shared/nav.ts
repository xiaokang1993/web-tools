export type PageType = 'util' | 'tool' | 'game' | 'media' | 'read'

export interface NavItem {
  name: string
  icon: string
  desc: string
  type: PageType
  path: string
}

export const TYPE_NAMES: Record<PageType, string> = {
  util: '实用',
  tool: '工具',
  game: '游戏',
  media: '媒体',
  read: '阅读'
}

export const navItems: NavItem[] = [
  { name: '计算器', icon: '🧮', desc: '智能计算工具', type: 'tool', path: '/calculator' },
  { name: '工具箱', icon: '🔧', desc: '实用工具集合', type: 'tool', path: '/toolbox' },
  { name: '待办事项', icon: '📝', desc: '任务管理清单', type: 'tool', path: '/todo' },
  { name: 'JSON 对比', icon: '📊', desc: '数据对比工具', type: 'tool', path: '/json-diff' },
  { name: '天气', icon: '🌤️', desc: '实时天气查询', type: 'util', path: '/weather' },
  { name: '倒计时', icon: '⏰', desc: '精确计时工具', type: 'util', path: '/countdown' },
  { name: '阅读器', icon: '📚', desc: '电子书阅读工具', type: 'read', path: '/reader' },
  { name: '电子礼簿', icon: '🧧', desc: '红白喜事礼金管理', type: 'util', path: '/gift-book' },
  { name: '网易音乐', icon: '🎵', desc: '在线音乐播放器', type: 'media', path: '/netease-music' },
  { name: '音乐播放器', icon: '🎸', desc: '本地音乐播放', type: 'media', path: '/music-player' },
  { name: '中国象棋', icon: '♟️', desc: '传统象棋游戏', type: 'game', path: '/chess' },
  { name: '五子棋', icon: '⚫', desc: '策略棋类游戏', type: 'game', path: '/gomoku' },
  { name: '贪吃蛇', icon: '🐍', desc: '经典游戏', type: 'game', path: '/snake' }
]

export const navTypes = Object.keys(TYPE_NAMES) as PageType[]
