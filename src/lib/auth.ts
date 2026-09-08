import { cookies } from "next/headers";
import { getUserByEmail } from "@/lib/db.mjs";

export async function getSession() {
  const c = await cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) return null;
  try {
    const user = getUserByEmail(session);
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}
