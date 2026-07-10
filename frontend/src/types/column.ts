import { DatasetType } from "./project";

export type FieldType =
  | "text"
  | "number"
  | "decimal"
  | "percentage"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multi_select"
  | "textarea"
  | "url";

export type ColumnDatasetType = DatasetType | "all";

export interface ColumnDefinition {
  id: number;
  dataset_type: ColumnDatasetType;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_system: boolean;
  is_visible: boolean;
  is_filterable: boolean;
  is_chartable: boolean;
  is_required: boolean;
  is_archived: boolean;
  default_value: string | null;
  options_json: string[] | null;
  sort_order: number;
  column_group: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Setting {
  id: number;
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  updated_at: string;
}
