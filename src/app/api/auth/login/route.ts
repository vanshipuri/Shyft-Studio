import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db.mjs";
import { redirectAfterPost } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "").trim();

  if (!email || !password) return redirectAfterPost("/login");

  const user = getUserByEmail(email);
  if (!user || user.password !== password) {
    return new NextResponse("Invalid credentials", { status: 401 });
  }

  const res = redirectAfterPost("/dashboard");
  res.cookies.set("shyft_session", email, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
