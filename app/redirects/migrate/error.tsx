"use client";

export default function MigrateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center gap-4 py-32 px-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
      <p className="text-muted-foreground">
        {error.message || "An unexpected error occurred while processing your file."}
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  );
}
