"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportApi } from "@/lib/api";

interface ExportButtonsProps {
  filters?: Record<string, string | undefined>;
  className?: string;
}

export function ExportButtons({ filters = {}, className }: ExportButtonsProps) {
  const handleExport = (type: "csv" | "excel") => {
    const url =
      type === "csv"
        ? exportApi.csvUrl(filters)
        : exportApi.excelUrl(filters);
    window.open(url, "_blank");
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => handleExport("csv")}
      >
        <Download size={13} />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => handleExport("excel")}
      >
        <FileSpreadsheet size={13} />
        Excel
      </Button>
    </div>
  );
}
