import { NextRequest, NextResponse } from "next/server";
import { lookupPhone } from "@/lib/repo";

export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get("number") ?? "";
  if (!number.trim()) {
    return NextResponse.json({ error: "number is required" }, { status: 400 });
  }
  const result = await lookupPhone(number);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}
