import api from './api'

export interface ProfileData {
  username: string
  email: string
  displayName?: string
}

export interface NotificationSettings {
  emailNotifications: boolean
  spiderSuccess: boolean
  spiderError: boolean
  systemUpdates: boolean
}

export interface SystemSettings {
  maxConcurrentSpiders: number
  defaultTimeout: number
  defaultRetries: number
  logRetentionDays: number
  fileRetentionDays: number
  apiCallIntervalMinutes: number
}

export interface ClearDataRequest {
  type: 'all' | 'logs' | 'files' | 'spiders'
}

export interface ExportData {
  spiders: any[]
  logs: any[]
  files: any[]
  settings: Record<string, any>
  export_time: string
  version: string
}

class SettingsService {
  // 个人资料相关
  async getProfile(): Promise<ProfileData> {
    const response = await api.get('/settings/profile')
    return response.data
  }

  async updateProfile(data: ProfileData): Promise<{ message: string; profile: ProfileData }> {
    const response = await api.post('/settings/profile', data)
    return response.data
  }

  // 通知设置相关
  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await api.get('/settings/notifications')
    return response.data
  }

  async updateNotificationSettings(data: NotificationSettings): Promise<{ message: string; notifications: NotificationSettings }> {
    const response = await api.post('/settings/notifications', data)
    return response.data
  }

  // 系统设置相关
  async getSystemSettings(): Promise<SystemSettings> {
    const response = await api.get('/settings/system')
    return response.data
  }

  async updateSystemSettings(data: SystemSettings): Promise<{ message: string; system: SystemSettings }> {
    const response = await api.post('/settings/system', data)
    return response.data
  }

  // 数据管理相关
  async clearData(request: ClearDataRequest): Promise<{ message: string }> {
    const response = await api.post('/settings/clear-data', request)
    return response.data
  }

  async exportData(): Promise<ExportData> {
    const response = await api.get('/settings/export')
    return response.data
  }

  async importData(data: any): Promise<{ message: string }> {
    // 这里可以实现数据导入逻辑，目前只是模拟
    console.log('Importing data:', data)
    return { message: 'Data imported successfully' }
  }

  async clearAllData(): Promise<{ message: string }> {
    const response = await api.post('/settings/clear-data', { type: 'all' })
    return response.data
  }
}

export const settingsService = new SettingsService()
export default settingsService