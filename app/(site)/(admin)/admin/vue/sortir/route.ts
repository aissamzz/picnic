import { NextResponse } from "next/server";
import { VIEW_AS_COOKIE } from "@/lib/config";

/** Ends a read-only "view as owner" session (plain form POST from the owner app banner). */
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin/restaurants", request.url), 303);
  res.cookies.delete(VIEW_AS_COOKIE);
  return res;
}
