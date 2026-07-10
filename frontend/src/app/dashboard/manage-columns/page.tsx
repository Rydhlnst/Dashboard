"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { columnsApi } from "@/lib/api";
import { ColumnDefinition, FieldType, ColumnDatasetType } from "@/types/column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Lock, Archive, ArchiveRestore, Edit2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const DATASETS: { value: ColumnDatasetType; label: string }[] = [
  { value: "all", label: "All Datasets" },
  { value: "closing", label: "Closing" },
  { value: "filter900", label: "Filter 900" },
  { value: "refinement", label: "Refinement" },
];

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal" },
  { value: "percentage", label: "Percentage" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "boolean", label: "Boolean (Yes/No)" },
  { value: "select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "textarea", label: "Long Text" },
  { value: "url", label: "URL" },
];

interface ColForm {
  label: string;
  field_key: string;
  dataset_type: ColumnDatasetType;
  field_type: FieldType;
  column_group: string;
  is_visible: boolean;
  is_filterable: boolean;
  is_chartable: boolean;
  is_required: boolean;
  default_value: string;
  options: string;
}

const defaultForm: ColForm = {
  label: "", field_key: "", dataset_type: "all", field_type: "text",
  column_group: "", is_visible: true, is_filterable: false, is_chartable: false,
  is_required: false, default_value: "", options: "",
};

export default function ManageColumnsPage() {
  const [activeDataset, setActiveDataset] = useState<ColumnDatasetType>("all");
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ColForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load all so we can filter client-side (includes archived if needed)
      const res = await columnsApi.list(activeDataset === "all" ? undefined : activeDataset);
      if (res.success && res.data) {
        setColumns(res.data as ColumnDefinition[]);
      }
    } finally { setLoading(false); }
  }, [activeDataset]);

  useEffect(() => { load(); }, [load]);

  const filteredCols = columns.filter((c) =>
    showArchived ? c.is_archived : !c.is_archived
  );

  const openCreate = () => {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (col: ColumnDefinition) => {
    setEditId(col.id);
    setForm({
      label: col.label,
      field_key: col.field_key,
      dataset_type: col.dataset_type,
      field_type: col.field_type,
      column_group: col.column_group ?? "",
      is_visible: col.is_visible,
      is_filterable: col.is_filterable,
      is_chartable: col.is_chartable,
      is_required: col.is_required,
      default_value: col.default_value ?? "",
      options: col.options_json?.join("\n") ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error("Label is required."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        label: form.label,
        dataset_type: form.dataset_type,
        field_type: form.field_type,
        column_group: form.column_group || null,
        is_visible: form.is_visible,
        is_filterable: form.is_filterable,
        is_chartable: form.is_chartable,
        is_required: form.is_required,
        default_value: form.default_value || null,
      };
      if (["select","multi_select"].includes(form.field_type) && form.options) {
        payload.options = form.options.split("\n").map((s) => s.trim()).filter(Boolean);
      }
      if (!editId) {
        payload.field_key = form.field_key || undefined;
      }

      const res = editId
        ? await columnsApi.update(editId, payload)
        : await columnsApi.create(payload);

      if (res.success) {
        toast.success(editId ? "Column updated." : "Column created.");
        setDialogOpen(false);
        load();
      } else {
        toast.error(res.message || "Save failed.");
      }
    } finally { setSaving(false); }
  };

  const toggleFlag = async (col: ColumnDefinition, flag: keyof Pick<ColumnDefinition, "is_visible" | "is_filterable" | "is_chartable">) => {
    const res = await columnsApi.update(col.id, { [flag]: !col[flag] });
    if (res.success) {
      setColumns((prev) => prev.map((c) => c.id === col.id ? { ...c, [flag]: !c[flag] } : c));
    }
  };

  const handleArchive = async (col: ColumnDefinition) => {
    const res = await columnsApi.archive(col.id, !col.is_archived);
    if (res.success) {
      toast.success(col.is_archived ? "Column restored." : "Column archived.");
      load();
    } else {
      toast.error(res.message);
    }
  };

  const moveOrder = async (col: ColumnDefinition, dir: "up" | "down") => {
    const sorted = [...filteredCols].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === col.id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sorted.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    const order = [
      { id: sorted[idx].id, sort_order: sorted[swapIdx].sort_order },
      { id: sorted[swapIdx].id, sort_order: sorted[idx].sort_order },
    ];
    await columnsApi.reorder(order);
    load();
  };

  return (
    <AppLayout title="Manage Columns" adminOnly>
      {/* Tabs */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          {DATASETS.map((d) => (
            <button
              key={d.value}
              onClick={() => setActiveDataset(d.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activeDataset === d.value
                  ? "bg-teal-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
          <Button size="sm" className="gap-1.5 h-8 bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreate}>
            <Plus size={13} /> Add Column
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Order</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Label</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Field Key</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Dataset</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Type</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Group</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Visible</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Filter</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Chart</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Req</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : filteredCols.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">No columns found.</td></tr>
            ) : (
              filteredCols.map((col) => (
                <tr key={col.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveOrder(col, "up")} disabled={col.is_system} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp size={12} /></button>
                      <span className="text-center text-[10px]">{col.sort_order}</span>
                      <button onClick={() => moveOrder(col, "down")} disabled={col.is_system} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown size={12} /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {col.is_system && <Lock size={11} className="text-muted-foreground/50 shrink-0" />}
                      <span className="font-medium">{col.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono">{col.field_key}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">{col.dataset_type}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{col.field_type}</td>
                  <td className="px-3 py-2 text-muted-foreground capitalize">{col.column_group}</td>
                  {(["is_visible", "is_filterable", "is_chartable"] as const).map((flag) => (
                    <td key={flag} className="px-3 py-2 text-center">
                      <button
                        onClick={() => !col.is_system && toggleFlag(col, flag)}
                        className={cn("w-7 h-4 rounded-full transition-colors", col[flag] ? "bg-teal-500" : "bg-muted")}
                        disabled={col.is_system}
                      >
                        <span className={cn("block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5", col[flag] ? "translate-x-3" : "translate-x-0")} />
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span className={cn("text-[10px] font-semibold", col.is_required ? "text-teal-500" : "text-muted-foreground")}>
                      {col.is_required ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {!col.is_system && (
                        <>
                          <button onClick={() => openEdit(col)} className="p-1 hover:bg-muted rounded">
                            <Edit2 size={12} className="text-muted-foreground" />
                          </button>
                          <button onClick={() => handleArchive(col)} className="p-1 hover:bg-muted rounded" title={col.is_archived ? "Restore" : "Archive"}>
                            {col.is_archived ? <ArchiveRestore size={12} className="text-green-500" /> : <Archive size={12} className="text-amber-500" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Column" : "Add New Column"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Label *</Label>
                <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">Field Key (auto if blank)</Label>
                <Input value={form.field_key} onChange={(e) => setForm((p) => ({ ...p, field_key: e.target.value }))} className="h-8 text-xs mt-1 font-mono" disabled={!!editId} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dataset</Label>
                <Select value={form.dataset_type} onValueChange={(v) => setForm((p) => ({ ...p, dataset_type: v as ColumnDatasetType }))} disabled={!!editId}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DATASETS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Field Type</Label>
                <Select value={form.field_type} onValueChange={(v) => setForm((p) => ({ ...p, field_type: v as FieldType }))} disabled={!!editId}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Column Group</Label>
              <Input value={form.column_group} onChange={(e) => setForm((p) => ({ ...p, column_group: e.target.value }))} className="h-8 text-xs mt-1" placeholder="e.g. basic, site, financial" />
            </div>
            {["select","multi_select"].includes(form.field_type) && (
              <div>
                <Label className="text-xs">Options (one per line)</Label>
                <textarea
                  value={form.options}
                  onChange={(e) => setForm((p) => ({ ...p, options: e.target.value }))}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none mt-1"
                  placeholder="Option A&#10;Option B&#10;Option C"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {([["is_visible","Visible"],["is_filterable","Filterable"],["is_chartable","Chartable"],["is_required","Required"]] as const).map(([flag, label]) => (
                <label key={flag} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form[flag]} onChange={(e) => setForm((p) => ({ ...p, [flag]: e.target.checked }))} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <Label className="text-xs">Default Value</Label>
              <Input value={form.default_value} onChange={(e) => setForm((p) => ({ ...p, default_value: e.target.value }))} className="h-8 text-xs mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
