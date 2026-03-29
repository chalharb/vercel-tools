import { RedirectsManager } from "../manager-client";
import { listProjects } from "@/lib/vercel";
import { notFound } from "next/navigation";
import type { PageProps } from "next";

export async function generateMetadata(
  props: PageProps<"/redirects/manage/[projectId]">
) {
  const { projectId } = await props.params;
  const projects = await listProjects();
  const project = projects.find((p) => p.id === projectId);
  return {
    title: project
      ? `${project.name} — Redirects — Vercel Tools`
      : "Redirects — Vercel Tools",
  };
}

export default async function ProjectRedirectsPage(
  props: PageProps<"/redirects/manage/[projectId]">
) {
  const { projectId } = await props.params;
  const projects = await listProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    notFound();
  }

  return (
    <main className="container mx-auto flex flex-col gap-6 py-8 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bulk Redirect Manager
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage Vercel Bulk Redirects
        </p>
      </div>

      <RedirectsManager
        projects={projects}
        initialProjectId={project.id}
        initialProjectName={project.name}
      />
    </main>
  );
}
