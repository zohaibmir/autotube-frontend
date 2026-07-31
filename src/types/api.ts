export interface Job {
  id: string
  channel_id: string
  channel_slug: string
  type: string // 'youtube_short', 'youtube_long', 'tiktok', 'reel'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  created_at: string
  started_at?: string
  completed_at?: string
  config: Record<string, any>
  output?: {
    video_id?: string
    url?: string
    thumbnail?: string
  }
  error?: string
}

export interface Channel {
  id: string
  channel_slug: string
  channel_name: string
  platform: 'youtube'
  account_id: string
  connected_at: string
  is_active: boolean
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  created_at: string
  plan: 'free' | 'pro' | 'enterprise'
  role?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}
