"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
  RowSelectionState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  onSortChange?: (sortBy: string, sortDir: "ASC" | "DESC") => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (v: VisibilityState) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (v: RowSelectionState) => void;
  stickyHeader?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  onSortChange,
  columnVisibility,
  onColumnVisibilityChange,
  rowSelection,
  onRowSelectionChange,
  stickyHeader = true,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: internalSorting,
      columnVisibility: columnVisibility ?? internalVisibility,
      rowSelection: rowSelection ?? internalSelection,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(internalSorting) : updater;
      setInternalSorting(next);
      if (onSortChange && next.length > 0) {
        onSortChange(next[0].id, next[0].desc ? "DESC" : "ASC");
      }
    },
    onColumnVisibilityChange: onColumnVisibilityChange ?? setInternalVisibility,
    onRowSelectionChange: onRowSelectionChange ?? setInternalSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: !!onSortChange,
    enableRowSelection: true,
  });

  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className={cn("bg-muted/50", stickyHeader && "sticky top-0 z-10")}>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap select-none",
                      canSort && "cursor-pointer hover:text-foreground"
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    colSpan={header.colSpan}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="text-muted-foreground/50">
                          {sorted === "asc" ? (
                            <ChevronUp size={12} />
                          ) : sorted === "desc" ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronsUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-muted-foreground text-sm"
              >
                No data found.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-border transition-colors",
                  row.getIsSelected()
                    ? "bg-teal-50 dark:bg-teal-950/20"
                    : "hover:bg-muted/40"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
