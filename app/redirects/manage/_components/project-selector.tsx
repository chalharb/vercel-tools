"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { VercelProject } from "@/lib/redirects-api";

interface ProjectSelectorProps {
  projects: VercelProject[];
  selectedProjectId: string;
  selectedProjectName: string;
  onProjectSelect: (projectId: string, projectName: string) => void;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  selectedProjectName,
  onProjectSelect,
}: ProjectSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="project-selector">Project</Label>
      <Select
        value={selectedProjectName}
        onValueChange={(value) => {
          if (!value) return;
          const project = projects.find((p) => p.name === value);
          if (project) onProjectSelect(project.id, project.name);
        }}
      >
        <SelectTrigger id="project-selector" className="w-[280px]">
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.name}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
