export type DatasetType = "closing" | "filter900" | "refinement";
export type ProgressStatus = "Completed" | "Not Yet" | "Dropped";

export interface ProjectRecord {
  id: number;
  dataset_type: DatasetType;
  import_batch_id: number | null;
  // Core identification
  pdid: string | null;
  po_year: string | null;
  caid: string | null;
  scarlett_ioms_id_before: string | null;
  scarlett_ioms_id_final: string | null;
  status_po: string | null;
  pono_tsel: string | null;
  capex: number | null;
  band: string | null;
  sector: string | null;
  project_category: string | null;
  sow_actual: string | null;
  vendor_principle: string | null;
  cr_status: string | null;
  status_eba_mapping: string | null;
  eba_mapping_number: string | null;
  donor_act_siteid: string | null;
  donor_nop: string | null;
  donor_tp: string | null;
  donor_progress: string | null;
  replan_dismantle: string | null;
  donor_dismantle_actual: string | null;
  // Site info
  siteid_po: string | null;
  siteid_act: string | null;
  neid_act: string | null;
  site_name: string | null;
  infra_type: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  province: string | null;
  nop: string | null;
  tp_detail: string | null;
  // Progress
  progress_done_flag: string | null;
  rfs_actual: string | null;
  rfs_month: string | null;
  mitra_impl: string | null;
  progress_act: string | null;
  issue_category: string | null;
  notes_progress: string | null;
  gap_analysis: string | null;
  blocking: boolean;
  support_needed: string | null;
  pic_blocking: string | null;
  detail_pic_blocking: string | null;
  gap_closing: string | null;
  current_position: string | null;
  status_project: string | null;
  progress_closing: string | null;
  sub_progress_closing: string | null;
  // Acceptance
  atp_status: string | null;
  atp_blocking: string | null;
  atp_tagging_plan_ori: string | null;
  atp_tagging_replan: string | null;
  atp_tagging_done: string | null;
  atp_approved: string | null;
  lv_status: string | null;
  lv_blocking: string | null;
  elv_plan_ori: string | null;
  elv_replan: string | null;
  elv_approved: string | null;
  oac_status: string | null;
  oac_blocking: string | null;
  oac_plan_ori: string | null;
  oac_replan: string | null;
  oac_approved: string | null;
  qc_status: string | null;
  qc_blocking: string | null;
  qc_plan_ori: string | null;
  qc_replan: string | null;
  qc_sign: string | null;
  sqac_status: string | null;
  sqac_blocking: string | null;
  sqac_plan_ori: string | null;
  sqac_replan: string | null;
  sqac_approved: string | null;
  baut_status: string | null;
  baut_blocking: string | null;
  baut_plan_ori: string | null;
  baut_replan: string | null;
  baut_approved: string | null;
  bast_status: string | null;
  bast_blocking: string | null;
  bast_plan_ori: string | null;
  bast_replan: string | null;
  bast_approved: string | null;
  // Financial
  price_po: number | null;
  price_po_to_be_claim: number | null;
  price_bast: number | null;
  remaining_po: number | null;
  price_po_presales: number | null;
  wbs_level3: string | null;
  network_number: string | null;
  cid1: string | null;
  cid1_price_bast: number | null;
  cid1_creation_date: string | null;
  cid1_approve_date: string | null;
  cid2: string | null;
  cid2_price_bast: number | null;
  cid2_creation_date: string | null;
  cid2_approve_date: string | null;
  // Filter 900 / Refinement specific
  remarks_sow: string | null;
  replan_rfs: string | null;
  plan_po: number | null;
  released_po: number | null;
  // Dynamic custom fields
  custom_fields: Record<string, unknown> | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: number | null;
  updated_by: number | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ProjectFilters {
  search?: string;
  dataset_type?: DatasetType | "";
  status_po?: string;
  status_project?: string;
  project_category?: string;
  vendor_principle?: string;
  mitra_impl?: string;
  nop?: string;
  tp_detail?: string;
  rfs_month?: string;
  po_year?: string;
  province?: string;
  city?: string;
  band?: string;
  blocking?: string;
  progress_status?: ProgressStatus | "";
  sort_by?: string;
  sort_dir?: "ASC" | "DESC";
  page?: number;
  limit?: number;
}

export interface SummaryKpi {
  total: number;
  completed: number;
  remaining: number;
  dropped: number;
  progress_pct: number;
  issues: number;
  last_update: string | null;
}

export interface SummaryResponse {
  kpi: SummaryKpi;
  financial: {
    total_price_po: number;
    total_claim: number;
    total_bast: number;
    total_remaining: number;
  };
  charts: {
    by_month: Array<{ label: string; rfs: number; ny: number }>;
    by_project_category: Array<{ label: string; value: number }>;
    by_nop: Array<{ label: string; value: number }>;
    by_vendor_principle: Array<{ label: string; value: number }>;
    by_mitra_impl: Array<{ label: string; value: number }>;
    by_issue_category: Array<{ label: string; value: number }>;
    by_status_po: Array<{ label: string; value: number }>;
    by_tp_detail: Array<{ label: string; value: number }>;
  };
  top_pending: ProjectRecord[];
}
