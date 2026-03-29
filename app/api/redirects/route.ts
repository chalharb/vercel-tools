import { NextRequest, NextResponse } from "next/server";
import {
  getRedirects,
  stageRedirects,
  editRedirect,
  deleteRedirects,
} from "@/lib/vercel";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  try {
    const data = await getRedirects(projectId, {
      versionId: searchParams.get("versionId") ?? undefined,
      diff: searchParams.get("diff") === "true",
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : undefined,
      perPage: searchParams.get("perPage")
        ? Number(searchParams.get("perPage"))
        : undefined,
      search: searchParams.get("search") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch redirects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, redirects, overwrite, name } = body;
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    const data = await stageRedirects(projectId, redirects, {
      overwrite,
      name,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stage redirects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, redirect, name, restore } = body;
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    const data = await editRedirect(projectId, redirect, { name, restore });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to edit redirect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sources, name } = body;
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    const data = await deleteRedirects(projectId, sources, { name });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete redirects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
