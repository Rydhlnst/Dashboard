export type ChartType =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "radar"
  | "radial"
  | "scatter";

export interface ChartDataItem {
  label: string;
  value: number;
}

export interface ChartData {
  group_by: string;
  items: ChartDataItem[];
  total: number;
}

export interface ChartPreference {
  id: number;
  chart_key: string;
  chart_type: ChartType;
  x_axis: string | null;
  y_axis: string | null;
  group_by: string | null;
  filters_json: Record<string, string> | null;
  updated_at: string;
}

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar Chart" },
  { value: "line", label: "Line Chart" },
  { value: "area", label: "Area Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "donut", label: "Donut Chart" },
  { value: "radar", label: "Radar Chart" },
  { value: "radial", label: "Radial Chart" },
  { value: "scatter", label: "Scatter Chart" },
];

export const GROUP_BY_OPTIONS = [
  { value: "status_project", label: "Status Project" },
  { value: "status_po", label: "Status PO" },
  { value: "province", label: "Province" },
  { value: "city", label: "City" },
  { value: "mitra_impl", label: "Mitra Implementasi" },
  { value: "project_category", label: "Project Category" },
  { value: "rfs_month", label: "RFS Month" },
  { value: "atp_status", label: "ATP Status" },
  { value: "lv_status", label: "LV Status" },
  { value: "oac_status", label: "OAC Status" },
  { value: "qc_status", label: "QC Status" },
  { value: "baut_status", label: "BAUT Status" },
  { value: "bast_status", label: "BAST Status" },
  { value: "band", label: "Band" },
  { value: "infra_type", label: "Infra Type" },
  { value: "issue_category", label: "Issue Category" },
];

export const DASHBOARD_CHARTS: { key: string; title: string; defaultGroupBy: string }[] = [
  { key: "status_project", title: "Status Project", defaultGroupBy: "status_project" },
  { key: "province", title: "By Province", defaultGroupBy: "province" },
  { key: "mitra_impl", title: "Mitra Implementasi", defaultGroupBy: "mitra_impl" },
  { key: "project_category", title: "Project Category", defaultGroupBy: "project_category" },
  { key: "rfs_month", title: "RFS Month", defaultGroupBy: "rfs_month" },
  { key: "atp_status", title: "ATP Status", defaultGroupBy: "atp_status" },
  { key: "baut_status", title: "BAUT Status", defaultGroupBy: "baut_status" },
  { key: "bast_status", title: "BAST Status", defaultGroupBy: "bast_status" },
];
