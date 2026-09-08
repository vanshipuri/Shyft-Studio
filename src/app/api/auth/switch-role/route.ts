import { NextRequest, NextResponse } from "next/server";
import { redirectAfterPost } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  let email = "samyak@shyft.studio";
  let redirectUrl = "/dashboard";

  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.email) email = body.email;
      if (body.redirectUrl) redirectUrl = body.redirectUrl;
    } else {
      const form = await req.formData();
      const formEmail = form.get("email");
      const formRedirect = form.get("redirectUrl");
      if (formEmail) email = String(formEmail);
      if (formRedirect) redirectUrl = String(formRedirect);
    }
  } catch {
    // fallback to default
  }

  const res = redirectAfterPost(redirectUrl);
  res.cookies.set("shyft_session", email, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax"
  });
  return res;
}
