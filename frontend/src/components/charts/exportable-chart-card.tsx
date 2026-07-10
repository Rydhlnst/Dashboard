"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChartExportRow = Record<string, string | number | null | undefined>;

interface ExportableChartCardProps {
  title: string;
  filename: string;
  data: ChartExportRow[];
  children: React.ReactNode;
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadChartCsv(filename: string, data: ChartExportRow[]) {
  if (!data.length) return;

  const headers = Array.from(
    data.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>())
  );

  const csv = [
    headers.join(","),
    ...data.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportableChartCard({ title, filename, data, children }: ExportableChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => downloadChartCsv(filename, data)}
          disabled={!data.length}
        >
          <Download size={13} />
          Chart CSV
        </Button>
      </div>
      {children}
    </div>
  );
}
