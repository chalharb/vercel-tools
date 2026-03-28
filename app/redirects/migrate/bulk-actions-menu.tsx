"use client";

import { ChevronDownIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BulkActionsMenuProps {
  appliedActions: Set<string>;
  hasManualDeletions: boolean;
  onToggleAction: (action: string) => void;
  onResetAll: () => void;
}

export function BulkActionsMenu({
  appliedActions,
  hasManualDeletions,
  onToggleAction,
  onResetAll,
}: BulkActionsMenuProps) {
  const hasAny = appliedActions.size > 0 || hasManualDeletions;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <Sparkles data-icon="inline-start" />
          Bulk Actions
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Clean up redirects</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onToggleAction("drop-trailing-slashes")}>
            <div className="flex flex-col">
              <span className="font-medium">
                {appliedActions.has("drop-trailing-slashes") ? "Restore" : "Drop"} trailing slash rows
              </span>
              <span className="text-xs text-muted-foreground">
                Remove rows where source ends with /
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggleAction("drop-redundant-duplicates")}>
            <div className="flex flex-col">
              <span className="font-medium">
                {appliedActions.has("drop-redundant-duplicates") ? "Restore" : "Drop"} redundant duplicates
              </span>
              <span className="text-xs text-muted-foreground">
                Keep first occurrence of same source → destination
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {hasAny && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onResetAll}>
                Reset all actions
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
