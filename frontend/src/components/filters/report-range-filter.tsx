"use client";

import { CalendarDays, CalendarRange, CalendarClock, CalendarCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "annually";

export interface ReportRangeValues {
  report_period: ReportPeriod;
  date_from: string;
  date_to: string;
}

interface ReportRangeFilterProps {
  value: ReportRangeValues;
  onChange: (value: ReportRangeValues) => void;
  className?: string;
}

const PERIODS: Array<{ value: ReportPeriod; label: string; icon: React.ElementType; color: string }> = [
  { value: "daily", label: "Daily", icon: CalendarDays, color: "text-sky-600" },
  { value: "weekly", label: "Weekly", icon: CalendarRange, color: "text-emerald-600" },
  { value: "monthly", label: "Monthly", icon: CalendarClock, color: "text-violet-600" },
  { value: "annually", label: "Annually", icon: CalendarCheck2, color: "text-orange-600" },
];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getReportRange(period: ReportPeriod, baseDate = new Date()): ReportRangeValues {
  const start = new Date(baseDate);
  const end = new Date(baseDate);

  if (period === "weekly") {
    start.setDate(baseDate.getDate() - 6);
  } else if (period === "monthly") {
    start.setDate(1);
  } else if (period === "annually") {
    start.setMonth(0, 1);
  }

  return {
    report_period: period,
    date_from: toDateInputValue(start),
    date_to: toDateInputValue(end),
  };
}

export function ReportRangeFilter({ value, onChange, className }: ReportRangeFilterProps) {
  const updateDate = (key: "date_from" | "date_to", nextValue: string) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 shadow-sm", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {PERIODS.map((period) => {
            const Icon = period.icon;
            const active = value.report_period === period.value;
            return (
              <button
                key={period.value}
                type="button"
                onClick={() => onChange(getReportRange(period.value))}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={14} className={active ? "text-primary-foreground" : period.color} />
                {period.label} Report
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:min-w-[180px] lg:min-w-0 lg:flex-row lg:items-center lg:gap-2">
            <span className="shrink-0">From</span>
            <input
              type="date"
              value={value.date_from}
              onChange={(event) => updateDate("date_from", event.target.value)}
              className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:min-w-[180px] lg:min-w-0 lg:flex-row lg:items-center lg:gap-2">
            <span className="shrink-0">To</span>
            <input
              type="date"
              value={value.date_to}
              onChange={(event) => updateDate("date_to", event.target.value)}
              className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
