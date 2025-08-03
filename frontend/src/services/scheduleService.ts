import api, { Schedule } from './api'

export interface CreateScheduleRequest {
  name: string
  trigger_type: 'cron' | 'interval'
  cron_config?: {
    second?: string
    minute?: string
    hour?: string
    day?: string
    month?: string
    day_of_week?: string
    year?: string
    timezone?: string
  }
  interval_config?: {
    weeks?: number
    days?: number
    hours?: number
    minutes?: number
    seconds?: number
  }
  misfire_grace_time?: number
  max_instances?: number
}

export interface UpdateScheduleRequest {
  name?: string
  trigger_type?: 'cron' | 'interval'
  cron_config?: {
    second?: string
    minute?: string
    hour?: string
    day?: string
    month?: string
    day_of_week?: string
    year?: string
    timezone?: string
  }
  interval_config?: {
    weeks?: number
    days?: number
    hours?: number
    minutes?: number
    seconds?: number
  }
}

class ScheduleService {
  // 获取爬虫的定时任务列表
  async getSpiderSchedules(spiderId: number): Promise<{
    spider_id: number
    schedules: Schedule[]
    total: number
  }> {
    const response = await api.get(`/spiders/${spiderId}/schedules`)
    return response
  }

  // 获取定时任务详情
  async getScheduleDetail(spiderId: number, jobId: string): Promise<Schedule> {
    const response = await api.get(`/spiders/${spiderId}/schedules/${jobId}`)
    return response
  }

  // 创建定时任务
  async createSchedule(
    spiderId: number,
    data: CreateScheduleRequest
  ): Promise<{ message: string; job_id: string; next_run_time?: string }> {
    const response = await api.post(`/spiders/${spiderId}/schedules`, data)
    return response
  }

  // 更新定时任务
  async updateSchedule(
    spiderId: number,
    jobId: string,
    data: UpdateScheduleRequest
  ): Promise<{ message: string; next_run_time?: string }> {
    const response = await api.put(`/spiders/${spiderId}/schedules/${jobId}`, data)
    return response
  }

  // 删除定时任务
  async deleteSchedule(spiderId: number, jobId: string): Promise<{ message: string }> {
    const response = await api.delete(`/spiders/${spiderId}/schedules/${jobId}`)
    return response
  }

  // 暂停定时任务
  async pauseSchedule(spiderId: number, jobId: string): Promise<{ message: string }> {
    const response = await api.post(`/spiders/${spiderId}/schedules/${jobId}/pause`)
    return response
  }

  // 恢复定时任务
  async resumeSchedule(
    spiderId: number,
    jobId: string
  ): Promise<{ message: string; next_run_time?: string }> {
    const response = await api.post(`/spiders/${spiderId}/schedules/${jobId}/resume`)
    return response
  }

  // 格式化下次运行时间
  formatNextRunTime(nextRunTime?: string): string {
    if (!nextRunTime) return '未安排'
    
    const date = new Date(nextRunTime)
    const now = new Date()
    
    // 如果是过去的时间，显示"已过期"
    if (date < now) {
      return '已过期'
    }
    
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
  getRelativeTime(nextRunTime?: string): string {
    if (!nextRunTime) return ''
    
    const date = new Date(nextRunTime)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    
    if (diffMs < 0) {
      return '已过期'
    }
    
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) {
      return `${diffSeconds}秒后`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟后`
    } else if (diffHours < 24) {
      return `${diffHours}小时后`
    } else {
      return `${diffDays}天后`
    }
  }

  // 解析触发器描述
  parseTriggerDescription(trigger: string, triggerType: string): string {
    if (triggerType === 'CronTrigger') {
      // 简化的cron表达式解析
      const cronParts = trigger.match(/\[(.*?)\]/)
      if (cronParts && cronParts[1]) {
        return `Cron: ${cronParts[1]}`
      }
      return 'Cron 触发器'
    } else if (triggerType === 'IntervalTrigger') {
      // 间隔触发器解析
      const intervalMatch = trigger.match(/interval\[([^\]]+)\]/)
      if (intervalMatch && intervalMatch[1]) {
        return `间隔: ${intervalMatch[1]}`
      }
      return '间隔触发器'
    }
    return trigger
  }

  // 验证cron表达式
  validateCronExpression(cronConfig: CreateScheduleRequest['cron_config']): boolean {
    if (!cronConfig) return false
    
    // 基本验证：至少需要设置分钟或小时
    const { minute = '*', hour = '*' } = cronConfig
    
    // 检查分钟字段
    if (minute !== '*') {
      const minuteNum = parseInt(minute)
      if (isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
        return false
      }
    }
    
    // 检查小时字段
    if (hour !== '*') {
      const hourNum = parseInt(hour)
      if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
        return false
      }
    }
    
    return true
  }

  // 验证间隔配置
  validateIntervalConfig(intervalConfig: CreateScheduleRequest['interval_config']): boolean {
    if (!intervalConfig) return false
    
    const { weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0 } = intervalConfig
    
    // 至少需要设置一个时间间隔
    const totalSeconds = weeks * 7 * 24 * 3600 + days * 24 * 3600 + hours * 3600 + minutes * 60 + seconds
    
    return totalSeconds > 0
  }

  // 生成cron表达式描述
  generateCronDescription(cronConfig: CreateScheduleRequest['cron_config']): string {
    if (!cronConfig) return ''
    
    const {
      second = '0',
      minute = '*',
      hour = '*',
      day = '*',
      month = '*',
      day_of_week = '*'
    } = cronConfig
    
    let description = ''
    
    if (minute !== '*' && hour !== '*') {
      description = `每天 ${hour}:${minute.padStart(2, '0')}`
    } else if (minute !== '*') {
      description = `每小时第 ${minute} 分钟`
    } else if (hour !== '*') {
      description = `每天 ${hour} 点`
    } else {
      description = '自定义时间'
    }
    
    if (day_of_week !== '*') {
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const dayNum = parseInt(day_of_week)
      if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
        description += ` (${weekDays[dayNum]})`
      }
    }
    
    return description
  }

  // 生成间隔描述
  generateIntervalDescription(intervalConfig: CreateScheduleRequest['interval_config']): string {
    if (!intervalConfig) return ''
    
    const { weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0 } = intervalConfig
    
    const parts: string[] = []
    
    if (weeks > 0) parts.push(`${weeks}周`)
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)
    if (seconds > 0) parts.push(`${seconds}秒`)
    
    return parts.length > 0 ? `每 ${parts.join('')}` : ''
  }
}

export const scheduleService = new ScheduleService()
export default scheduleService