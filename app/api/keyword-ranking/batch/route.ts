import { NextResponse } from "next/server";

import { runBatch, validateBatchRequest } from "@/lib/keyword-ranking-search";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateBatchRequest(
    typeof body === "object" && body !== null ? body : {},
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const result = await runBatch(
    validated.request,
    validated.domain,
    request.signal,
  );
  return NextResponse.json(result);
}
