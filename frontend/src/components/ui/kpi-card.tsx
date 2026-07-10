import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  accentColor?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-neutral-700 dark:text-neutral-200",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {title}
        </p>
        {Icon && (
          <div className="rounded-md border bg-muted p-1.5">
            <Icon size={14} className={cn(iconColor)} />
          </div>
        )}
      </div>
      <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
