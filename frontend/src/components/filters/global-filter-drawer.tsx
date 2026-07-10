"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterValues {
  search?: string;
  dataset_type?: string;
  po_year?: string;
  project_category?: string;
  status_po?: string;
  vendor_principle?: string;
  nop?: string;
  tp_detail?: string;
  mitra_impl?: string;
  rfs_month?: string;
  progress_status?: string;
  province?: string;
}

interface GlobalFilterDrawerProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  showDatasetFilter?: boolean;
  className?: string;
}

const STATUS_PO_OPTIONS = ["Active", "Drop", "Plan", "Released", "Hold"];
const PROGRESS_STATUS_OPTIONS = ["Completed", "Not Yet", "Dropped"];

export function GlobalFilterDrawer({
  values,
  onChange,
  showDatasetFilter = false,
  className,
}: GlobalFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  const update = (key: keyof FilterValues, value: string) => {
    onChange({ ...values, [key]: value === "_all" ? "" : value });
  };

  const reset = () => {
    onChange({});
    setOpen(false);
  };

  const activeCount = Object.values(values).filter(
    (v) => v !== undefined && v !== ""
  ).length;

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={13} />
        Filter
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-40 bg-card border border-border rounded-xl shadow-xl w-80 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Filters</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
                <button onClick={() => setOpen(false)}>
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Search</Label>
                <Input
                  placeholder="PDID, Site Name, SiteID…"
                  value={values.search ?? ""}
                  onChange={(e) => update("search", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              {showDatasetFilter && (
                <div>
                  <Label className="text-xs">Dataset</Label>
                  <Select
                    value={values.dataset_type || "_all"}
                    onValueChange={(v) => update("dataset_type", v)}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All Datasets</SelectItem>
                      <SelectItem value="closing">Closing</SelectItem>
                      <SelectItem value="filter900">Filter 900</SelectItem>
                      <SelectItem value="refinement">Refinement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-xs">PO Year</Label>
                <Input
                  placeholder="e.g. 2024"
                  value={values.po_year ?? ""}
                  onChange={(e) => update("po_year", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Status PO</Label>
                <Select
                  value={values.status_po || "_all"}
                  onValueChange={(v) => update("status_po", v)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All</SelectItem>
                    {STATUS_PO_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Progress Status</Label>
                <Select
                  value={values.progress_status || "_all"}
                  onValueChange={(v) => update("progress_status", v)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All</SelectItem>
                    {PROGRESS_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Project Category</Label>
                <Input
                  placeholder="e.g. Filter 900"
                  value={values.project_category ?? ""}
                  onChange={(e) => update("project_category", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Vendor Principle</Label>
                <Input
                  placeholder=""
                  value={values.vendor_principle ?? ""}
                  onChange={(e) => update("vendor_principle", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">NOP</Label>
                <Input
                  placeholder="e.g. PONTIANAK"
                  value={values.nop ?? ""}
                  onChange={(e) => update("nop", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Mitra Impl</Label>
                <Input
                  placeholder=""
                  value={values.mitra_impl ?? ""}
                  onChange={(e) => update("mitra_impl", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">RFS Month</Label>
                <Input
                  placeholder="e.g. 2024-03"
                  value={values.rfs_month ?? ""}
                  onChange={(e) => update("rfs_month", e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <Button
              className="w-full mt-4 h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
