import api, { SpiderLog, PaginatedResponse, LogStatistics } from './api'

export interface LogListParams {
  page?: number
  per_page?: number
  level?: string
  source?: string
  execution_id?: string
  start_date?: string
  end_date?: string
  search?: string
}

export interface CreateLogRequest {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG'
  message: string
  source?: string
  execution_id?: string
}

export interface ClearLogsRequest {
  keep_days?: number
}

class LogService {
  // 获取爬虫日志列表
  async getSpiderLogs(
    spiderId: number,
    params: LogListParams = {}
  ): Promise<PaginatedResponse<SpiderLog> & { statistics: LogStatistics }> {
    const response = await api.get(`/spiders/${spiderId}/logs`, { params })
    return response
  }

  // 获取日志详情
  async getLogDetail(spiderId: number, logId: number): Promise<SpiderLog> {
    const response = await api.get(`/spiders/${spiderId}/logs/${logId}`)
    return response
  }

  // 创建日志记录
  async createLog(spiderId: number, data: CreateLogRequest): Promise<SpiderLog> {
    const response = await api.post(`/spiders/${spiderId}/logs`, data)
    return response
  }

  // 批量删除日志
  async batchDeleteLogs(
    spiderId: number,
    logIds: number[]
  ): Promise<{ message: string; deleted_count: number }> {
    const response = await api.post(`/spiders/${spiderId}/logs/batch-delete`, {
      log_ids: logIds,
    })
    return response
  }

  // 清空日志
  async clearLogs(
    spiderId: number,
    options: ClearLogsRequest = {}
  ): Promise<{ message: string; deleted_count: number }> {
    const response = await api.post(`/spiders/${spiderId}/logs/clear`, options)
    return response
  }

  // 导出日志
  async exportLogs(
    spiderId: number,
    params: LogListParams & { format?: 'json' | 'csv' } = {}
  ): Promise<Blob> {
    const response = await api.get(`/spiders/${spiderId}/logs/export`, {
      params,
      responseType: 'blob',
    })
    return response
  }

  // 获取日志统计信息
  async getLogStatistics(
    spiderId: number,
    startDate?: string,
    endDate?: string
  ): Promise<LogStatistics> {
    const params: any = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    
    const response = await api.get(`/spiders/${spiderId}/logs/statistics`, { params })
    return response
  }

  // 获取日志级别颜色
  getLogLevelColor(level: string): string {
    const colorMap: Record<string, string> = {
      INFO: 'text-blue-600 dark:text-blue-400',
      WARNING: 'text-yellow-600 dark:text-yellow-400',
      ERROR: 'text-red-600 dark:text-red-400',
      DEBUG: 'text-gray-600 dark:text-gray-400',
    }
    return colorMap[level] || colorMap.INFO
  }

  // 获取日志级别图标
  getLogLevelIcon(level: string): string {
    const iconMap: Record<string, string> = {
      INFO: 'ℹ️',
      WARNING: '⚠️',
      ERROR: '❌',
      DEBUG: '🐛',
    }
    return iconMap[level] || iconMap.INFO
  }

  // 格式化日志时间
  formatLogTime(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 获取相对时间
  getRelativeTime(timestamp: string): string {
    const now = new Date()
    const logTime = new Date(timestamp)
    const diffMs = now.getTime() - logTime.getTime()
    
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) {
      return `${diffSeconds}秒前`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`
    } else if (diffHours < 24) {
      return `${diffHours}小时前`
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return this.formatLogTime(timestamp)
    }
  }

  // 过滤日志消息（高亮搜索关键词）
  highlightSearchTerm(message: string, searchTerm: string): string {
    if (!searchTerm) return message
    
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    return message.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>')
  }

  // 获取日志导出文件名
  getExportFileName(spiderId: number, format: 'json' | 'csv' = 'json'): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    return `spider_${spiderId}_logs_${timestamp}.${format}`
  }
}

export const logService = new LogService()
export default logService