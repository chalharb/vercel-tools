import { NextRequest, NextResponse } from "next/server";
import { getVersionHistory, updateVersion } from "@/lib/vercel";

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
    const data = await getVersionHistory(projectId);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch versions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, versionId, action, name } = body;
    if (!projectId || !versionId || !action) {
      return NextResponse.json(
        { error: "projectId, versionId, and action are required" },
        { status: 400 }
      );
    }
    const data = await updateVersion(projectId, versionId, action, { name });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
