import { redirectAfterPost } from "@/lib/redirect";

export async function POST() {
  const res = redirectAfterPost("/login");
  res.cookies.set("shyft_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
