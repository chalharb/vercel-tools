"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface FacetFilter {
  columnId: string;
  label: string;
  options: { label: string; value: string }[];
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  facetFilters?: FacetFilter[];
  onDeleteRows?: (indices: number[]) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  facetFilters,
  onDeleteRows,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [facetValues, setFacetValues] = useState<Record<string, string>>({});

  const allColumns: ColumnDef<TData, TValue>[] = onDeleteRows
    ? [
        {
          id: "select",
          size: 40,
          minSize: 40,
          maxSize: 40,
          enableSorting: false,
          enableResizing: false,
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          ),
        } as ColumnDef<TData, TValue>,
        ...columns,
        {
          id: "actions",
          size: 50,
          minSize: 50,
          maxSize: 50,
          enableSorting: false,
          enableResizing: false,
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteRows([row.index])}
            >
              <Trash2Icon className="size-4" />
            </Button>
          ),
        } as ColumnDef<TData, TValue>,
      ]
    : columns;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is not compatible with React Compiler memoization
  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    filterFns: {
      facet: (row, columnId, filterValue: string) => {
        const val = (row.getValue(columnId) as string) ?? "";
        if (filterValue === "__all__") return true;
        if (filterValue === "__any__") return val.length > 0;
        if (filterValue === "__none__") return val.length === 0;
        return val.includes(filterValue);
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  const handleDeleteSelected = () => {
    if (!onDeleteRows || selectedCount === 0) return;
    const indices = Object.keys(rowSelection).map(Number);
    onDeleteRows(indices);
    setRowSelection({});
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter all columns…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          {selectedCount > 0 && onDeleteRows && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete {selectedCount} row{selectedCount !== 1 && "s"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {facetFilters?.map((facet) => (
            <div key={facet.columnId} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {facet.label}
              </span>
              <Select
                value={facetValues[facet.columnId] ?? "__all__"}
                onValueChange={(value) => {
                  setFacetValues((prev) => ({
                    ...prev,
                    [facet.columnId]: value,
                  }));
                  const col = table.getColumn(facet.columnId);
                  if (col) {
                    col.setFilterValue(value === "__all__" ? undefined : value);
                  }
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder={facet.label} />
                </SelectTrigger>
                <SelectContent>
                  {facet.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 250, 500].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table
          className="w-full table-fixed"
          style={{ minWidth: table.getTotalSize() }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="relative group overflow-hidden [&:has(:focus-visible)]:overflow-visible"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <ArrowUpDownIcon
                          className={cn(
                            "size-3.5 text-muted-foreground/50",
                            header.column.getIsSorted() && "text-foreground",
                          )}
                        />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                    {/* Resize handle */}
                    {header.column.columnDef.enableResizing !== false && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100",
                          "bg-border",
                          header.column.getIsResizing() &&
                            "opacity-100 bg-primary",
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="overflow-hidden [&:has(:focus-visible)]:overflow-visible"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  className="h-24 text-center"
                >
                  {columnFilters.length > 0 || globalFilter ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">
                        No rows match the current filter.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setColumnFilters([]);
                          setGlobalFilter("");
                          setFacetValues({});
                        }}
                      >
                        Reset filters
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No results.</p>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount > 0 && (
            <span className="font-medium text-foreground">
              {selectedCount} selected ·{" "}
            </span>
          )}
          {table.getFilteredRowModel().rows.length} row
          {table.getFilteredRowModel().rows.length !== 1 && "s"}
          {globalFilter && " (filtered)"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Build column definitions dynamically from string header names.
 * Useful for CSV data where columns aren't known at compile time.
 */
export function buildColumnsFromHeaders(
  headers: string[],
): ColumnDef<Record<string, string>>[] {
  return headers.map((header) => ({
    // Use accessorFn + explicit id for headers containing dots so TanStack
    // Table doesn't interpret them as nested key paths.
    id: header,
    accessorFn: (row) => row[header] ?? "",
    header: header,
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return (
        <span className="truncate block" title={value}>
          {value}
        </span>
      );
    },
    size: 200,
    minSize: 80,
  }));
}
