import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", "http://localhost"));
  res.cookies.set("shyft_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
