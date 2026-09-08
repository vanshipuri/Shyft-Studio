import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db.mjs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "").trim();

  if (!email || !password) return NextResponse.redirect(new URL("/login", req.url));

  const user = getUserByEmail(email);
  if (!user || user.password !== password) {
    return new NextResponse("Invalid credentials", { status: 401 });
  }

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("shyft_session", email, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
