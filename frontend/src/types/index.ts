// TypeScript types for MPLADS Sentinel

export interface Dataset {
  id: number
  name: string
  filename: string
  file_size: number
  row_count: number
  column_count: number
  dataset_type: 'uploaded' | 'demo'
  data_quality_score: number
  uploaded_at: string
  analyzed_at: string | null
  status: string
}

export interface Project {
  id: number
  dataset_id: number
  project_id: string
  project_name: string | null
  state: string | null
  district: string | null
  constituency: string | null
  category: string | null
  sanctioned_amount: number | null
  released_amount: number | null
  expenditure: number | null
  financial_utilisation: number | null
  physical_progress: number | null
  start_date: string | null
  expected_completion: string | null
  actual_completion: string | null
  planned_duration: number | null
  elapsed_months: number | null
  status: string | null
  location: string | null
  // joined from risk_scores
  schedule_score?: number
  financial_score?: number
  peer_score?: number
  final_score?: number
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW'
  primary_signal?: string
  // joined from reviews
  review_status?: string
  review_id?: number
  // full detail
  alerts?: RiskAlert[]
  audit_history?: AuditLog[]
}

export interface RiskAlert {
  id: number
  project_id: number
  rule_id: string
  rule_name: string
  signal_type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  evidence: Record<string, unknown>
  explanation: string
  score_contribution: number
}

export interface Review {
  id: number
  project_id: number
  dataset_id: number
  status: ReviewStatus
  priority: string
  assigned_to: string | null
  created_at: string
  updated_at: string
  project_id_str?: string
  project_name?: string
  state?: string
  final_score?: number
  risk_level?: string
  comments?: ReviewComment[]
}

export interface ReviewComment {
  id: number
  review_id: number
  author: string
  comment: string
  created_at: string
}

export type ReviewStatus =
  | 'UNREVIEWED'
  | 'UNDER REVIEW'
  | 'INVESTIGATING'
  | 'VERIFIED CONCERN'
  | 'FALSE POSITIVE'
  | 'RESOLVED'
  | 'ESCALATED'

export interface AuditLog {
  id: number
  dataset_id: number | null
  project_id: number | null
  review_id: number | null
  action: string
  details: string
  actor: string
  created_at: string
}

export interface AnalyticsSummary {
  total_projects: number
  high_risk: number
  medium_risk: number
  low_risk: number
  requires_review: number
  avg_financial_utilisation: number
  avg_physical_progress: number
  total_sanctioned: number
  total_expenditure: number
  signals: { signal_type: string; cnt: number }[]
  review_stats: { status: string; cnt: number }[]
  score_distribution: { range: string; count: number }[]
  scatter_data: {
    id: number
    project_id: string
    project_name: string
    financial_utilisation: number
    physical_progress: number
    final_score: number
    risk_level: string
  }[]
  state_risk: { state: string; risk_level: string; cnt: number }[]
}

export interface PaginatedProjects {
  total: number
  page: number
  page_size: number
  pages: number
  projects: Project[]
}

export interface PaginatedQueue {
  total: number
  page: number
  page_size: number
  pages: number
  queue: Project[]
}

export interface Settings {
  risk_low_threshold: string
  risk_medium_threshold: string
  schedule_weight: string
  financial_weight: string
  peer_weight: string
  peer_min_group_size: string
}

export interface ColumnMapping {
  [field: string]: string | null
}

export interface ValidationResult {
  total_rows: number
  valid_rows: number
  issues: { type: string; field: string; message: string; count: number }[]
  warnings: { type: string; field: string; message: string; count: number }[]
  data_quality_score: number
  completeness_pct: number
  mapped_fields: number
  total_fields: number
}
