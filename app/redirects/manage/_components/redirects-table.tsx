"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  caseSensitive?: boolean;
  preserveQueryParams?: boolean;
  action?: string;
}

interface RedirectsTableProps {
  redirects: Redirect[];
  selectedSources: Set<string>;
  onSelectionChange: (sources: Set<string>) => void;
  onEdit: (redirect: Redirect) => void;
  onDelete: (sources: string[]) => void;
  sortBy: string;
  sortOrder: string;
  onSort: (field: string) => void;
  showActions?: boolean;
}

function getStatusCode(r: Redirect): number {
  if (r.statusCode) return r.statusCode;
  if (r.permanent === true) return 308;
  if (r.permanent === false) return 307;
  return 307;
}

function ActionBadge({ action }: { action?: string }) {
  if (!action) return null;

  const config: Record<string, { label: string; className: string }> = {
    "+": {
      label: "Added",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    "-": {
      label: "Deleted",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    "~": {
      label: "Modified",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
  };

  const { label, className } = config[action] ?? {
    label: action,
    className: "",
  };

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export function RedirectsTable({
  redirects,
  selectedSources,
  onSelectionChange,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
  showActions = false,
}: RedirectsTableProps) {
  const allSelected =
    redirects.length > 0 && selectedSources.size === redirects.length;

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(redirects.map((r) => r.source)));
    }
  }

  function toggleOne(source: string) {
    const next = new Set(selectedSources);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    onSelectionChange(next);
  }

  function SortableHeader({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) {
    const isActive = sortBy === field;
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50"
        onClick={() => onSort(field)}
      >
        <span className="flex items-center gap-1">
          {children}
          {isActive && (
            <span className="text-xs">
              {sortOrder === "asc" ? "\u2191" : "\u2193"}
            </span>
          )}
        </span>
      </TableHead>
    );
  }

  if (redirects.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No redirects found. Create one to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </TableHead>
          <SortableHeader field="source">Source</SortableHeader>
          <SortableHeader field="statusCode">Code</SortableHeader>
          <SortableHeader field="destination">Destination</SortableHeader>
          {showActions && <TableHead>Change</TableHead>}
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {redirects.map((redirect) => {
          const code = getStatusCode(redirect);
          const isDeleted = redirect.action === "-";
          return (
            <TableRow
              key={redirect.source}
              className={isDeleted ? "opacity-60 line-through" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selectedSources.has(redirect.source)}
                  onCheckedChange={() => toggleOne(redirect.source)}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {redirect.source}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    code === 301 || code === 308 ? "default" : "secondary"
                  }
                >
                  {code}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm max-w-[400px] truncate">
                {redirect.destination}
              </TableCell>
              {showActions && (
                <TableCell>
                  <ActionBadge action={redirect.action} />
                </TableCell>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(redirect)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete([redirect.source])}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
