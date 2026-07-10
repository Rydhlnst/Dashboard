const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost/backend";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string>;
  meta?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok && data.success === undefined) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function buildQS(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    request("/api/auth/login.php", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signup: (name: string, email: string, password: string) =>
    request("/api/auth/signup.php", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  logout: () =>
    request("/api/auth/logout.php", { method: "POST" }),

  me: () => request("/api/auth/me.php"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request("/api/auth/change-password.php", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
};

// ─── Projects ───────────────────────────────────────────────────────────────

export const projectApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    request(`/api/projects/index.php?${buildQS(params)}`),

  get: (id: number) => request(`/api/projects/show.php?id=${id}`),

  create: (data: Record<string, unknown>) =>
    request("/api/projects/create.php", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Record<string, unknown>) =>
    request(`/api/projects/update.php?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request(`/api/projects/delete.php?id=${id}`, { method: "DELETE" }),

  bulkDelete: (ids: number[]) =>
    request("/api/projects/bulk-delete.php", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),
};

export const projectsApi = projectApi;

// ─── Import (staging pipeline) ──────────────────────────────────────────────

export const importApi = {
  /** Step 1 — Upload file into staging, returns batch_id + column detection */
  upload: async (file: File, datasetType: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dataset_type", datasetType);
    const res = await fetch(`${API_URL}/api/import/upload.php`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    return res.json();
  },

  /** Step 2 — Apply column mapping + validate all staging rows */
  validate: (
    batchId: number,
    columnActions: Record<string, { action: "create" | "map" | "ignore"; field_key?: string }>
  ) =>
    request("/api/import/validate.php", {
      method: "POST",
      body: JSON.stringify({ batch_id: batchId, column_actions: columnActions }),
    }),

  /** Step 3 — Paginated staging rows (for review UI) */
  getStaging: (
    batchId: number,
    page = 1,
    limit = 50,
    status: "all" | "valid" | "warning" | "error" | "imported" = "all"
  ) =>
    request(
      `/api/import/staging.php?${buildQS({ batch_id: batchId, page, limit, status })}`
    ),

  /** Step 4 — Confirm import (upsert valid/warning rows into project_records) */
  confirm: (batchId: number, includeWarnings: boolean) =>
    request("/api/import/confirm.php", {
      method: "POST",
      body: JSON.stringify({ batch_id: batchId, include_warnings: includeWarnings }),
    }),

  /** Download error/warning rows as CSV */
  downloadErrorsUrl: (batchId: number, status = "error,warning") =>
    `${API_URL}/api/import/download-errors.php?batch_id=${batchId}&status=${encodeURIComponent(status)}`,

  /** Discard a batch (cleanup staging, no project_records affected) */
  discard: (batchId: number) =>
    request("/api/import/discard.php", {
      method: "DELETE",
      body: JSON.stringify({ batch_id: batchId }),
    }),
};

// ─── Analytics / Dashboard ──────────────────────────────────────────────────

export const dashboardApi = {
  summary: (params: Record<string, string | undefined> = {}) =>
    request(`/api/analytics/summary.php?${buildQS(params)}`),
};

export const analyticsApi = {
  summary: (params: Record<string, string | undefined> = {}) =>
    request(`/api/analytics/summary.php?${buildQS(params)}`),

  charts: (params: Record<string, string | number | undefined> = {}) =>
    request(`/api/analytics/charts.php?${buildQS(params)}`),
};

export const chartsApi = {
  data: (params: Record<string, string | undefined> = {}) =>
    request(`/api/analytics/charts.php?${buildQS(params)}`),
};

// ─── Chart Preferences ──────────────────────────────────────────────────────

export const chartPrefsApi = {
  list: () => request("/api/chart-preferences/index.php"),

  save: (data: {
    chart_key: string;
    chart_type: string;
    group_by?: string;
    filters?: Record<string, string>;
  }) =>
    request("/api/chart-preferences/save.php", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Column Definitions ─────────────────────────────────────────────────────

export const columnsApi = {
  list: (datasetType?: string) =>
    request(`/api/columns/index.php${datasetType ? `?dataset_type=${datasetType}` : ""}`),

  create: (data: Record<string, unknown>) =>
    request("/api/columns/create.php", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Record<string, unknown>) =>
    request(`/api/columns/update.php?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  archive: (id: number, archive = true) =>
    request(`/api/columns/archive.php?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({ archive }),
    }),

  reorder: (order: Array<{ id: number; sort_order: number }>) =>
    request("/api/columns/reorder.php", {
      method: "POST",
      body: JSON.stringify({ order }),
    }),
};

// ─── Export ─────────────────────────────────────────────────────────────────

export const exportApi = {
  csvUrl: (params: Record<string, string | undefined> = {}): string => {
    const qs = buildQS(params);
    return `${API_URL}/api/export/csv.php${qs ? `?${qs}` : ""}`;
  },
  excelUrl: (params: Record<string, string | undefined> = {}): string => {
    const qs = buildQS(params);
    return `${API_URL}/api/export/excel.php${qs ? `?${qs}` : ""}`;
  },
};

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export const auditLogApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    request(`/api/audit-logs/index.php?${buildQS(params)}`),
};

// ─── Settings ───────────────────────────────────────────────────────────────

export const settingsApi = {
  list: () => request("/api/settings/index.php"),

  update: (settings: Array<{ key: string; value: string | null }>) =>
    request("/api/settings/update.php", {
      method: "PUT",
      body: JSON.stringify({ settings: settings.map((s) => ({ key: s.key, value: s.value })) }),
    }),
};

// ─── Users ──────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    request(`/api/users/index.php?${buildQS(params)}`),

  updateRole: (userId: number, role: "super_admin" | "admin" | "viewer") =>
    request("/api/users/update-role.php", {
      method: "PUT",
      body: JSON.stringify({ user_id: userId, role }),
    }),

  updateStatus: (userId: number, status: "active" | "inactive" | "pending") =>
    request("/api/users/update-status.php", {
      method: "PUT",
      body: JSON.stringify({ user_id: userId, status }),
    }),

  create: (data: { name: string; email: string; password: string; role: string; status?: string }) =>
    request("/api/users/create.php", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
