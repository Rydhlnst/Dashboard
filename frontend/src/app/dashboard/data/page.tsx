"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { projectApi, exportApi } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { ProjectRecord, ProjectFilters, PaginatedResponse, DatasetType } from "@/types/project";
import { getStoredUser } from "@/lib/auth";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, ChevronLeft, ChevronRight, Trash2, Eye, ChevronUp, ChevronDown,
  Download, Columns, Settings2, ShieldAlert, AlertTriangle, Loader2, FileSpreadsheet, Pencil,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const LIMIT_OPTIONS = [10, 20, 50, 100];

const DATASETS: { value: DatasetType | ""; label: string }[] = [
  { value: "", label: "All Datasets" },
  { value: "closing", label: "Closing Progress" },
  { value: "filter900", label: "Filter 900" },
  { value: "refinement", label: "Refinement / Combat" },
];

const DEFAULT_COLS = [
  "pdid", "caid", "site_name", "dataset_type", "status_po",
  "project_category", "mitra_impl", "rfs_month", "progress_act",
  "progress_closing", "blocking", "issue_category", "nop",
] as const;

type ColKey = typeof DEFAULT_COLS[number];

const COL_LABELS: Record<ColKey, string> = {
  pdid: "PDID", caid: "CAID", site_name: "Site Name", dataset_type: "Dataset",
  status_po: "Status PO", project_category: "Category", mitra_impl: "Mitra",
  rfs_month: "RFS Month", progress_act: "Progress Act", progress_closing: "Progress Closing",
  blocking: "Blocking", issue_category: "Issue Category", nop: "NOP",
};

export default function ProjectsDataPage() {
  const user = getStoredUser();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [data, setData] = useState<PaginatedResponse<ProjectRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailRecord, setDetailRecord] = useState<ProjectRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [filters, setFilters] = useState<ProjectFilters>({
    page: 1,
    limit: 20,
    sort_by: "id",
    sort_dir: "ASC",
  });
  const [searchInput, setSearchInput] = useState("");

  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>(
    Object.fromEntries(DEFAULT_COLS.map((c) => [c, true])) as Record<ColKey, boolean>
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await projectApi.list(filters as Record<string, string | number>) as PaginatedResponse<ProjectRecord> & { success: boolean };
      if (res.success) setData(res);
    } catch {
      toast.error("Failed to load data.");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFilter = (key: keyof ProjectFilters, value: string | number | undefined) => {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  };

  const resetFilters = () => {
    setFilters({ page: 1, limit: filters.limit, sort_by: "id", sort_dir: "ASC" });
    setSearchInput("");
  };

  const handleSearch = () => updateFilter("search", searchInput.trim() || undefined);

  const handleSort = (col: string) => {
    setFilters((f) => ({
      ...f,
      sort_by: col,
      sort_dir: f.sort_by === col && f.sort_dir === "ASC" ? "DESC" : "ASC",
    }));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await projectApi.delete(deleteId) as { success: boolean; message?: string };
      if (res.success) {
        toast.success("Record deleted.");
        setDeleteId(null);
        fetchData();
      } else {
        toast.error(res.message ?? "Delete failed.");
      }
    } catch { toast.error("Delete failed."); }
    finally { setDeleting(false); }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      const res = await projectApi.bulkDelete(ids) as { success: boolean; message?: string };
      if (res.success) {
        toast.success(`${ids.length} records deleted.`);
        setSelected(new Set());
        setConfirmBulkDelete(false);
        fetchData();
      } else {
        toast.error(res.message ?? "Bulk delete failed.");
      }
    } catch { toast.error("Bulk delete failed."); }
    finally { setBulkDeleting(false); }
  };

  const openEdit = async (id: number) => {
    try {
      const res = await projectApi.get(id) as { success: boolean; data: ProjectRecord };
      if (res.success) {
        const r = res.data;
        setEditForm({
          status_po: r.status_po ?? "",
          status_project: (r as any).status_project ?? "",
          progress_act: r.progress_act ?? "",
          progress_closing: r.progress_closing ?? "",
          progress_done_flag: r.progress_done_flag ?? "",
          rfs_actual: r.rfs_actual ?? "",
          rfs_month: r.rfs_month ?? "",
          mitra_impl: r.mitra_impl ?? "",
          issue_category: r.issue_category ?? "",
          pic_blocking: r.pic_blocking ?? "",
          notes_progress: (r as any).notes_progress ?? "",
          blocking: r.blocking ? "1" : "0",
          atp_status: r.atp_status ?? "",
          lv_status: r.lv_status ?? "",
          oac_status: r.oac_status ?? "",
          qc_status: r.qc_status ?? "",
          sqac_status: r.sqac_status ?? "",
          baut_status: r.baut_status ?? "",
          bast_status: r.bast_status ?? "",
        });
        setEditId(id);
      } else {
        toast.error("Failed to load record.");
      }
    } catch {
      toast.error("Failed to load record.");
    }
  };

  const handleSave = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...editForm };
      payload.blocking = editForm.blocking === "1" ? 1 : 0;
      const res = await projectApi.update(editId, payload) as { success: boolean; message?: string };
      if (res.success) {
        toast.success("Record updated.");
        setEditId(null);
        fetchData();
      } else {
        toast.error(res.message ?? "Update failed.");
      }
    } catch {
      toast.error("Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: number) => {
    setDetailId(id);
    setLoadingDetail(true);
    setDetailRecord(null);
    try {
      const res = await projectApi.get(id) as { success: boolean; data: ProjectRecord; message?: string };
      if (res.success) setDetailRecord(res.data);
      else { toast.error(res.message); setDetailId(null); }
    } catch { toast.error("Failed to load record."); setDetailId(null); }
    finally { setLoadingDetail(false); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (filters.sort_by !== col) return null;
    return filters.sort_dir === "ASC"
      ? <ChevronUp size={13} className="inline ml-0.5" />
      : <ChevronDown size={13} className="inline ml-0.5" />;
  };

  const toggleCol = (col: ColKey) => setVisibleColumns((p) => ({ ...p, [col]: !p[col] }));

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.data.length) setSelected(new Set());
    else setSelected(new Set(data.data.map((r) => r.id)));
  };

  const meta = data?.meta;
  const rows = data?.data ?? [];
  const allChecked = rows.length > 0 && selected.size === rows.length;

  const parseNumber = (val: unknown): number => {
    const num = parseFloat(String(val ?? "0"));
    return isNaN(num) ? 0 : num;
  };

  const exportCSV = () => window.open(exportApi.csvUrl(filters as Record<string, string>), "_blank");
  const exportExcel = () => window.open(exportApi.excelUrl(filters as Record<string, string>), "_blank");

  const DATASET_BADGE: Record<DatasetType, string> = {
    closing: "bg-teal-100 text-teal-700",
    filter900: "bg-blue-100 text-blue-700",
    refinement: "bg-purple-100 text-purple-700",
  };

  return (
    <AppLayout title="Detail Data">
      {/* Toolbar */}
      <div className="bg-card rounded-xl border border-border p-3 mb-4">
        {/* Row 1: search + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-56">
            <Input
              placeholder="Search PDID, CAID, Site Name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={handleSearch} className="h-8 px-2.5 bg-teal-600 hover:bg-teal-700 text-white">
              <Search size={13} />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setConfirmBulkDelete(true)}
              >
                <Trash2 size={12} /> Delete ({selected.size})
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Columns size={13} /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DEFAULT_COLS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col}
                    checked={visibleColumns[col]}
                    onCheckedChange={() => toggleCol(col)}
                    className="text-xs"
                  >
                    {COL_LABELS[col]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 gap-1.5 text-xs">
              <Download size={12} /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} className="h-8 gap-1.5 text-xs">
              <FileSpreadsheet size={12} /> Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
              Reset
            </Button>
          </div>
        </div>

        {/* Row 2: filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={(filters.dataset_type as string) ?? ""} onValueChange={(v) => updateFilter("dataset_type", v || undefined)}>
            <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="All Datasets" /></SelectTrigger>
            <SelectContent>
              {DATASETS.map((d) => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.status_po ?? ""} onValueChange={(v) => updateFilter("status_po", v || undefined)}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Status PO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">All PO Status</SelectItem>
              {["Active", "Drop", "Hold"].map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={(filters.progress_status as string) ?? ""} onValueChange={(v) => updateFilter("progress_status", v || undefined)}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Progress Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">All Progress</SelectItem>
              {["Completed", "Not Yet", "Dropped"].map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={String(filters.limit)} onValueChange={(v) => updateFilter("limit", Number(v))}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((l) => <SelectItem key={l} value={String(l)} className="text-xs">{l} rows</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              {isAdmin && (
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                </th>
              )}
              {DEFAULT_COLS.filter((c) => visibleColumns[c]).map((col) => (
                <th
                  key={col}
                  onClick={() => !["progress_act", "progress_closing", "blocking"].includes(col) && handleSort(col)}
                  className={cn(
                    "px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap",
                    !["progress_act", "progress_closing", "blocking"].includes(col) && "cursor-pointer hover:text-foreground"
                  )}
                >
                  {COL_LABELS[col]}
                  {!["progress_act", "progress_closing", "blocking", "dataset_type"].includes(col) && <SortIcon col={col} />}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-16">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {isAdmin && <td className="px-3 py-3"><div className="h-3.5 w-3.5 bg-muted animate-pulse rounded" /></td>}
                  {DEFAULT_COLS.filter((c) => visibleColumns[c]).map((_, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3.5 bg-muted animate-pulse rounded w-full" /></td>
                  ))}
                  <td className="px-3 py-3"><div className="h-3.5 w-8 bg-muted animate-pulse rounded ml-auto" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={DEFAULT_COLS.filter((c) => visibleColumns[c]).length + (isAdmin ? 2 : 1)} className="px-4 py-14 text-center text-muted-foreground">
                  <AlertTriangle size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-medium text-sm">No records found</p>
                  <p className="text-xs mt-0.5">Try adjusting your filters</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-border hover:bg-muted/20 transition-colors",
                    selected.has(row.id) && "bg-teal-50 dark:bg-teal-950/20"
                  )}
                >
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                    </td>
                  )}

                  {visibleColumns.pdid && <td className="px-3 py-2 font-mono">{row.pdid ?? "-"}</td>}
                  {visibleColumns.caid && <td className="px-3 py-2 font-mono">{row.caid ?? "-"}</td>}
                  {visibleColumns.site_name && <td className="px-3 py-2 font-medium max-w-40 truncate">{row.site_name ?? "-"}</td>}
                  {visibleColumns.dataset_type && (
                    <td className="px-3 py-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", DATASET_BADGE[row.dataset_type])}>
                        {row.dataset_type}
                      </span>
                    </td>
                  )}
                  {visibleColumns.status_po && <td className="px-3 py-2">{row.status_po ?? "-"}</td>}
                  {visibleColumns.project_category && <td className="px-3 py-2 max-w-32 truncate">{row.project_category ?? "-"}</td>}
                  {visibleColumns.mitra_impl && <td className="px-3 py-2">{row.mitra_impl ?? "-"}</td>}
                  {visibleColumns.rfs_month && <td className="px-3 py-2">{row.rfs_month ?? "-"}</td>}

                  {visibleColumns.progress_act && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Progress value={parseNumber(row.progress_act)} className="h-1.5 w-14" />
                        <span className="font-mono text-[10px] w-7 text-right">{row.progress_act ?? "0"}%</span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.progress_closing && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Progress value={parseNumber(row.progress_closing)} className="h-1.5 w-14" />
                        <span className="font-mono text-[10px] w-7 text-right">{row.progress_closing ?? "0"}%</span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.blocking && (
                    <td className="px-3 py-2">
                      {row.blocking
                        ? <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Blocked</Badge>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  )}
                  {visibleColumns.issue_category && <td className="px-3 py-2 max-w-32 truncate text-muted-foreground">{row.issue_category ?? "-"}</td>}
                  {visibleColumns.nop && <td className="px-3 py-2">{row.nop ?? "-"}</td>}

                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDetail(row.id)}>
                        <Eye size={13} />
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(row.id)}>
                          <Pencil size={13} />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(row.id)}>
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && (
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {meta.total > 0
              ? `Showing ${((meta.page - 1) * meta.limit) + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${formatNumber(meta.total)}`
              : "No data"}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={meta.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>
              <ChevronLeft size={13} />
            </Button>
            <span className="px-2">Page {meta.page} of {meta.total_pages}</span>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={meta.page >= meta.total_pages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 size={18} className="text-teal-500" />
              {detailRecord?.site_name ?? "Loading…"}
            </DialogTitle>
            <DialogDescription>Full record detail</DialogDescription>
          </DialogHeader>

          {loadingDetail && (
            <div className="flex items-center justify-center py-14">
              <Loader2 size={32} className="animate-spin text-teal-500" />
            </div>
          )}

          {detailRecord && (
            <div className="space-y-5 text-xs pt-2">
              {[
                {
                  title: "Identifiers", fields: [
                    ["PDID", detailRecord.pdid], ["CAID", detailRecord.caid],
                    ["Dataset", detailRecord.dataset_type], ["PO Year", detailRecord.po_year],
                    ["Status PO", detailRecord.status_po], ["PoNo Tsel", detailRecord.pono_tsel],
                    ["Project Category", detailRecord.project_category], ["SOW Actual", detailRecord.sow_actual],
                  ],
                },
                {
                  title: "Site Info", fields: [
                    ["Site Name", detailRecord.site_name], ["Site ID PO", detailRecord.siteid_po],
                    ["Site ID Act", detailRecord.siteid_act], ["NOP", detailRecord.nop],
                    ["Province", detailRecord.province], ["City", detailRecord.city],
                    ["Lat / Lng", detailRecord.lat ? `${detailRecord.lat}, ${detailRecord.lng}` : null],
                    ["Infra Type", detailRecord.infra_type],
                  ],
                },
                {
                  title: "Progress", fields: [
                    ["RFS Actual", detailRecord.rfs_actual], ["RFS Month", detailRecord.rfs_month],
                    ["Progress Act", detailRecord.progress_act ? `${detailRecord.progress_act}%` : null],
                    ["Progress Closing", detailRecord.progress_closing ? `${detailRecord.progress_closing}%` : null],
                    ["Mitra Impl", detailRecord.mitra_impl], ["Vendor Principle", detailRecord.vendor_principle],
                    ["Issue Category", detailRecord.issue_category], ["PIC Blocking", detailRecord.pic_blocking],
                  ],
                },
                {
                  title: "Acceptance", fields: [
                    ["ATP Blocking", detailRecord.atp_blocking], ["LV Blocking", detailRecord.lv_blocking],
                    ["OAC Blocking", detailRecord.oac_blocking], ["QC Blocking", detailRecord.qc_blocking],
                    ["SQAC Blocking", detailRecord.sqac_blocking], ["BAUT Blocking", detailRecord.baut_blocking],
                    ["BAST Blocking", detailRecord.bast_blocking], ["ATP Approved", detailRecord.atp_approved],
                  ],
                },
                {
                  title: "Financial", fields: [
                    ["Price PO", detailRecord.price_po ? `Rp ${formatNumber(detailRecord.price_po)}` : null],
                    ["Price Claim", detailRecord.price_po_to_be_claim ? `Rp ${formatNumber(detailRecord.price_po_to_be_claim)}` : null],
                    ["Price BAST", detailRecord.price_bast ? `Rp ${formatNumber(detailRecord.price_bast)}` : null],
                    ["Remaining PO", detailRecord.remaining_po ? `Rp ${formatNumber(detailRecord.remaining_po)}` : null],
                    ["WBS Level3", detailRecord.wbs_level3], ["Network Number", detailRecord.network_number],
                  ],
                },
              ].map(({ title, fields }) => (
                <div key={title}>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 pb-1 border-b border-border">{title}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {fields.map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5 break-all">{(value as string) ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {detailRecord.custom_fields && Object.keys(detailRecord.custom_fields).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 pb-1 border-b border-border">Custom Fields</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(detailRecord.custom_fields).map(([key, val]) => (
                      <div key={key}>
                        <p className="text-muted-foreground">{key}</p>
                        <p className="font-medium mt-0.5">{String(val ?? "—")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-3 mt-4">
            <Button size="sm" onClick={() => setDetailId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil size={16} className="text-blue-500" />
              Edit Record
            </DialogTitle>
            <DialogDescription>Update field values for this project record.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm">
            {/* Status */}
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 pb-1 border-b">Status</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "status_po", label: "Status PO" },
                  { key: "status_project", label: "Status Project" },
                  { key: "progress_done_flag", label: "Progress Flag (1/0/x)" },
                  { key: "rfs_month", label: "RFS Month (YYYY-MM)" },
                  { key: "rfs_actual", label: "RFS Actual (YYYY-MM-DD)" },
                  { key: "mitra_impl", label: "Mitra Impl" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      className="h-8 text-xs"
                      value={editForm[key] ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 pb-1 border-b">Progress</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "progress_act", label: "Progress Act (%)" },
                  { key: "progress_closing", label: "Progress Closing (%)" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      className="h-8 text-xs"
                      value={editForm[key] ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Issues & Blocking */}
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 pb-1 border-b">Issues & Blocking</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Issue Category</Label>
                  <Input className="h-8 text-xs" value={editForm.issue_category ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, issue_category: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">PIC Blocking</Label>
                  <Input className="h-8 text-xs" value={editForm.pic_blocking ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, pic_blocking: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Blocking</Label>
                  <Select value={editForm.blocking ?? "0"} onValueChange={(v) => setEditForm((f) => ({ ...f, blocking: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-xs">No</SelectItem>
                      <SelectItem value="1" className="text-xs">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Notes Progress</Label>
                  <Input className="h-8 text-xs" value={editForm.notes_progress ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes_progress: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Acceptance Status */}
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 pb-1 border-b">Acceptance Status</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {["atp_status","lv_status","oac_status","qc_status","sqac_status","baut_status","bast_status"].map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{key.replace("_status","").toUpperCase()}</Label>
                    <Input className="h-8 text-xs" value={editForm[key] ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 mt-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record?</AlertDialogTitle>
            <AlertDialogDescription>This record will be soft-deleted and can be restored by an admin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Records?</AlertDialogTitle>
            <AlertDialogDescription>
              These {selected.size} records will be soft-deleted. This action can be reversed by a super admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting…" : `Delete ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
