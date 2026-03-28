import type { Metadata } from "next";
import { MigrateClient } from "./migrate-client";

export const metadata: Metadata = {
  title: "Redirect Migration Tool — Vercel Tools",
  description: "Upload a CSV to analyze, clean up, and bulk-import redirects into Vercel.",
};

export default function MigratePage() {
  return (
    <main className="container mx-auto flex flex-col gap-6 py-8 px-4">
      <MigrateClient />
    </main>
  );
}
