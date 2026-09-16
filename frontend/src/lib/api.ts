// API client for MPLADS Sentinel backend

const API_HOST = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const BASE = `${API_HOST}/api`

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Datasets ─────────────────────────────────────────────────────────────────
export const api = {
  // Health
  health: () => request<{ status: string }>('/health'),

  // Datasets
  datasets: {
    list: () => request<unknown[]>('/datasets'),
    get: (id: number) => request<unknown>(`/datasets/${id}`),
    delete: (id: number) => request<unknown>(`/datasets/${id}`, { method: 'DELETE' }),
  },

  // Projects
  projects: {
    list: (params: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, String(v)))
      return request<unknown>(`/projects?${q}`)
    },
    get: (id: number) => request<unknown>(`/projects/${id}`),
    peers: (id: number) => request<unknown>(`/projects/${id}/peers`),
  },

  // Risk queue
  riskQueue: (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, String(v)))
    return request<unknown>(`/risk-queue?${q}`)
  },

  // Analytics
  analytics: {
    summary: (datasetId?: number) =>
      request<unknown>(`/analytics/summary${datasetId ? `?dataset_id=${datasetId}` : ''}`),
  },

  // Reviews
  reviews: {
    list: (params?: { dataset_id?: number; status?: string }) => {
      const q = new URLSearchParams()
      if (params?.dataset_id) q.set('dataset_id', String(params.dataset_id))
      if (params?.status) q.set('status', params.status)
      return request<unknown[]>(`/reviews?${q}`)
    },
    get: (id: number) => request<unknown>(`/reviews/${id}`),
    update: (id: number, data: unknown) =>
      request<unknown>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // Audit logs
  auditLogs: (params?: { dataset_id?: number; project_id?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.dataset_id) q.set('dataset_id', String(params.dataset_id))
    if (params?.project_id) q.set('project_id', String(params.project_id))
    if (params?.limit) q.set('limit', String(params.limit))
    return request<unknown[]>(`/audit-logs?${q}`)
  },

  // Settings
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    update: (data: Record<string, string>) =>
      request<unknown>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // Export
  export: {
    projects: (datasetId?: number, riskLevel?: string) => {
      const q = new URLSearchParams()
      if (datasetId) q.set('dataset_id', String(datasetId))
      if (riskLevel) q.set('risk_level', riskLevel)
      window.open(`${BASE}/export/projects?${q}`, '_blank')
    },
  },
}
