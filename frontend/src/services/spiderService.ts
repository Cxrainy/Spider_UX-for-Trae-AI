import api, { Spider, PaginatedResponse, SpiderStatus } from './api'

export interface CreateSpiderRequest {
  name: string
  description?: string
  code: string
  config?: Record<string, any>
}

export interface UpdateSpiderRequest {
  name?: string
  description?: string
  code?: string
  config?: Record<string, any>
}

export interface SpiderListParams {
  page?: number
  per_page?: number
  search?: string
  status?: string
}

class SpiderService {
  // 获取爬虫列表
  async getSpiders(params: SpiderListParams = {}): Promise<PaginatedResponse<Spider>> {
    const response = await api.get('/spiders', { params })
    return response
  }

  // 获取单个爬虫
  async getSpider(id: number): Promise<Spider> {
    const response = await api.get(`/spiders/${id}`)
    return response
  }

  // 创建爬虫
  async createSpider(data: CreateSpiderRequest): Promise<Spider> {
    const response = await api.post('/spiders', data)
    return response
  }

  // 更新爬虫
  async updateSpider(id: number, data: UpdateSpiderRequest): Promise<Spider> {
    const response = await api.put(`/spiders/${id}`, data)
    return response
  }

  // 删除爬虫
  async deleteSpider(id: number): Promise<{ message: string }> {
    const response = await api.delete(`/spiders/${id}`)
    return response
  }

  // 运行爬虫
  async runSpider(id: number): Promise<{ message: string; execution_id: string; status: string }> {
    const response = await api.post(`/spiders/${id}/run`)
    return response
  }

  // 停止爬虫
  async stopSpider(id: number): Promise<{ message: string; status: string }> {
    const response = await api.post(`/spiders/${id}/stop`)
    return response
  }

  // 获取爬虫状态
  async getSpiderStatus(id: number): Promise<SpiderStatus> {
    const response = await api.get(`/spiders/${id}/status`)
    return response
  }

  // 健康检查
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    const response = await api.get('/health')
    return response
  }
}

export const spiderService = new SpiderService()
export default spiderService