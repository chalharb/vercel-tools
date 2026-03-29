import { NextRequest, NextResponse } from "next/server";
import { restoreRedirects } from "@/lib/redirects-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sources, name } = body;
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }
    const data = await restoreRedirects(projectId, sources, { name });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to restore redirects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
