import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail } from "@/lib/db.mjs";

export default async function IndexPage() {
  const c = await cookies();
  const session = c.get("shyft_session")?.value;
  if (session) {
    const user = getUserByEmail(session);
    if (user) redirect("/dashboard");
  }
  redirect("/login");
}
