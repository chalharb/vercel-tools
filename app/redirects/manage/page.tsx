import { listProjects } from "@/lib/redirects-api";
import Link from "next/link";
import { ArrowRightIcon, LayoutListIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Redirects — Vercel Tools",
  description: "Tools for managing Vercel redirects.",
};

export default async function RedirectsManagePage() {
  const projects = await listProjects();

  return (
    <main className="container mx-auto flex flex-col gap-6 py-8 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bulk Redirect Manager
        </h1>
        <p className="mt-2 text-muted-foreground">
          Select a project to view and manage its bulk redirects.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted-foreground">
          No projects found. Create a project on Vercel to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/redirects/manage/${project.id}`}
              className="block"
            >
              <Card className="group transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <LayoutListIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {project.name}
                      </CardTitle>
                    </div>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {project.framework ?? "Vercel Project"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
