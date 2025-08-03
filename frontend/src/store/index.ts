import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Spider, SpiderStatus } from '../services/api'

// 主题状态
interface ThemeState {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

// 爬虫状态
interface SpiderState {
  spiders: Spider[]
  currentSpider: Spider | null
  runningSpiders: Record<number, SpiderStatus>
  setSpiders: (spiders: Spider[]) => void
  setCurrentSpider: (spider: Spider | null) => void
  updateSpider: (spider: Spider) => void
  addSpider: (spider: Spider) => void
  removeSpider: (spiderId: number) => void
  setSpiderStatus: (spiderId: number, status: SpiderStatus) => void
  removeSpiderStatus: (spiderId: number) => void
}

// 通知状态
interface NotificationState {
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message?: string
    timestamp: number
  }>
  addNotification: (notification: Omit<NotificationState['notifications'][0], 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

// 侧边栏状态
interface SidebarState {
  isCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

// 主题store
export const useThemeStore = create<ThemeState>()(devtools(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme })
        // 应用主题到DOM
        const root = document.documentElement
        if (theme === 'dark') {
          root.classList.add('dark')
        } else if (theme === 'light') {
          root.classList.remove('dark')
        } else {
          // system theme
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          if (isDark) {
            root.classList.add('dark')
          } else {
            root.classList.remove('dark')
          }
        }
        // 保存到localStorage
        localStorage.setItem('theme', theme)
      },
    }),
    {
      name: 'theme-store',
    }
  ))

// 爬虫store
export const useSpiderStore = create<SpiderState>()(devtools(
    (set, get) => ({
      spiders: [],
      currentSpider: null,
      runningSpiders: {},
      setSpiders: (spiders) => set({ spiders }),
      setCurrentSpider: (spider) => set({ currentSpider: spider }),
      updateSpider: (spider) => {
        const { spiders, currentSpider } = get()
        const updatedSpiders = spiders.map((s) => (s.id === spider.id ? spider : s))
        set({
          spiders: updatedSpiders,
          currentSpider: currentSpider?.id === spider.id ? spider : currentSpider,
        })
      },
      addSpider: (spider) => {
        const { spiders } = get()
        set({ spiders: [...spiders, spider] })
      },
      removeSpider: (spiderId) => {
        const { spiders, currentSpider, runningSpiders } = get()
        const updatedSpiders = spiders.filter((s) => s.id !== spiderId)
        const updatedRunningSpiders = { ...runningSpiders }
        delete updatedRunningSpiders[spiderId]
        
        set({
          spiders: updatedSpiders,
          currentSpider: currentSpider?.id === spiderId ? null : currentSpider,
          runningSpiders: updatedRunningSpiders,
        })
      },
      setSpiderStatus: (spiderId, status) => {
        const { runningSpiders } = get()
        set({
          runningSpiders: {
            ...runningSpiders,
            [spiderId]: status,
          },
        })
      },
      removeSpiderStatus: (spiderId) => {
        const { runningSpiders } = get()
        const updatedRunningSpiders = { ...runningSpiders }
        delete updatedRunningSpiders[spiderId]
        set({ runningSpiders: updatedRunningSpiders })
      },
    }),
    {
      name: 'spider-store',
    }
  ))

// 通知store
export const useNotificationStore = create<NotificationState>()(devtools(
    (set, get) => ({
      notifications: [],
      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9)
        const timestamp = Date.now()
        const newNotification = { ...notification, id, timestamp }
        
        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }))
        
        // 不自动删除通知，保留历史记录供用户回溯
        // 用户可以手动删除或清空所有通知
      },
      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }))
      },
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'notification-store',
    }
  ))

// 侧边栏store
export const useSidebarStore = create<SidebarState>()(devtools(
    (set) => ({
      isCollapsed: false,
      toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
    }),
    {
      name: 'sidebar-store',
    }
  ))

// 初始化主题
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
  const theme = savedTheme || 'system'
  
  useThemeStore.getState().setTheme(theme)
}

// 监听系统主题变化
const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  const handleChange = () => {
    const { theme } = useThemeStore.getState()
    if (theme === 'system') {
      useThemeStore.getState().setTheme('system')
    }
  }
  
  mediaQuery.addEventListener('change', handleChange)
  
  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}

// 导出初始化函数
export const initializeStore = () => {
  initializeTheme()
  return watchSystemTheme()
}

// 导出便捷的hooks
export const useTheme = () => useThemeStore((state) => state.theme)
export const useSetTheme = () => useThemeStore((state) => state.setTheme)

export const useSpiders = () => useSpiderStore((state) => state.spiders)
export const useCurrentSpider = () => useSpiderStore((state) => state.currentSpider)
export const useRunningSpiders = () => useSpiderStore((state) => state.runningSpiders)

export const useNotifications = () => useNotificationStore((state) => state.notifications)
export const useAddNotification = () => useNotificationStore((state) => state.addNotification)
export const useRemoveNotification = () => useNotificationStore((state) => state.removeNotification)
export const useClearNotifications = () => useNotificationStore((state) => state.clearNotifications)

export const useSidebar = () => useSidebarStore((state) => ({ 
  isCollapsed: state.isCollapsed,
  toggle: state.toggleSidebar,
  setCollapsed: state.setSidebarCollapsed
}))