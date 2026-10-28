import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";

/** "Did you mean" for unknown menu links (public data only). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  if (q.length < 3) return NextResponse.json([]);
  const { data } = await createAnonClient().rpc("suggest_restaurants", { p_query: q });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
