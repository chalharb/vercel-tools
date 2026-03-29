import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  totalPaths: number;
  pathsWithIssues: number;
  conflicts: number;
}

export function SummaryCard({
  totalPaths,
  pathsWithIssues,
  conflicts,
}: SummaryCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Total paths</p>
            <p className="text-2xl font-bold">{totalPaths.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Paths with issues</p>
            <p className="text-2xl font-bold text-yellow-500">
              {pathsWithIssues.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Conflicts</p>
            <p className="text-2xl font-bold text-destructive">
              {conflicts.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
